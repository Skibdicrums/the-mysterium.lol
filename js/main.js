import * as THREE from 'https://cdn.skypack.dev/three@0.155.0';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.155.0/examples/jsm/controls/PointerLockControls.js';

let scene, camera, renderer;
let clock, deltaTime;
let playerMixer;
let playerModel;
let controls;

const moveSpeed = 10;
const gravity = 30;
const jumpVelocity = 15;

let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let canJump = false;

const keysPressed = {};

const raycaster = new THREE.Raycaster();

const blocks = [];
const blockSize = 2;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071017);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // Helpers
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1630 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = 0;
  scene.add(floor);

  // Debug red cube so you see something even if model fails
  const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.set(0, 1, 0);
  scene.add(cube);

  // Load player model
  const loader = new GLTFLoader();
  loader.load(
    '/models/player.glb',  // Adjust path if needed
    (gltf) => {
      playerModel = gltf.scene;
      playerModel.scale.set(1.5, 1.5, 1.5);
      playerModel.position.set(0, 0, 0);
      playerModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      scene.add(playerModel);

      if (gltf.animations && gltf.animations.length) {
        playerMixer = new THREE.AnimationMixer(playerModel);
        playerMixer.clipAction(gltf.animations[0]).play();
      }
    },
    undefined,
    (err) => {
      console.error('Error loading player model:', err);
    }
  );

  // Controls
  controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.getObject());

  // Start with camera above floor, looking forward
  controls.getObject().position.set(0, 2, 10);

  document.body.addEventListener('click', () => {
    controls.lock();
  });

  // Movement keys
  document.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
  });
  document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
  });

  // Mouse buttons for shooting/building
  document.addEventListener('mousedown', onMouseDown);

  // Prevent context menu on right click
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(event) {
  if (!controls.isLocked) return;

  if (event.button === 0) {
    shootBullet();
  } else if (event.button === 2) {
    toggleBlock();
  }
}

function shootBullet() {
  const origin = controls.getObject().position.clone();
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(camera.quaternion);

  raycaster.set(origin, direction);

  const intersects = raycaster.intersectObjects(blocks, false);

  if (intersects.length > 0) {
    const hitBlock = intersects[0].object;
    scene.remove(hitBlock);
    blocks.splice(blocks.indexOf(hitBlock), 1);
    console.log('Block destroyed!');
  } else {
    console.log('Shot fired, no block hit');
  }
}

function toggleBlock() {
  const origin = controls.getObject().position.clone();
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(camera.quaternion);

  const pos = origin.clone().add(dir.multiplyScalar(5));
  pos.y = Math.floor(pos.y / blockSize) * blockSize + blockSize / 2;

  for (const block of blocks) {
    if (block.position.distanceTo(pos) < 1) {
      scene.remove(block);
      blocks.splice(blocks.indexOf(block), 1);
      console.log('Block removed');
      return;
    }
  }

  const cubeGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.copy(pos);
  cube.castShadow = true;
  cube.receiveShadow = true;

  scene.add(cube);
  blocks.push(cube);
  console.log('Block placed');
}

function animate() {
  requestAnimationFrame(animate);

  deltaTime = clock.getDelta();

  if (playerMixer) playerMixer.update(deltaTime);

  if (controls.isLocked) {
    updateMovement(deltaTime);
  }

  renderer.render(scene, camera);
}

function updateMovement(delta) {
  direction.set(0, 0, 0);

  if (keysPressed['KeyW']) direction.z -= 1;
  if (keysPressed['KeyS']) direction.z += 1;
  if (keysPressed['KeyA']) direction.x -= 1;
  if (keysPressed['KeyD']) direction.x += 1;

  direction.normalize();

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  velocity.x += direction.x * moveSpeed * delta;
  velocity.z += direction.z * moveSpeed * delta;

  velocity.y -= gravity * delta;

  if (controls.getObject().position.y <= 2) {
    velocity.y = 0;
    controls.getObject().position.y = 2;
    canJump = true;
  }

  if (canJump && keysPressed['Space']) {
    velocity.y = jumpVelocity;
    canJump = false;
  }

  controls.getObject().position.x += velocity.x * delta;
  controls.getObject().position.y += velocity.y * delta;
  controls.getObject().position.z += velocity.z * delta;

  if (playerModel) {
    playerModel.position.set(
      controls.getObject().position.x,
      controls.getObject().position.y - 2,
      controls.getObject().position.z
    );
    playerModel.rotation.y = camera.rotation.y;
  }
}