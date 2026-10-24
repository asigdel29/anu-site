// Entry point for anu's cherry blossom island: loads the scene, plays the intro,
// and wires object clicks, modals, sound and the day/night theme.

import gsap from "gsap";
import { Howl, Howler } from "howler";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import themeVertexShader from "./shaders/theme/vertex.glsl";
import themeFragmentShader from "./shaders/theme/fragment.glsl";
import petalVertexShader from "./shaders/petals/vertex.glsl";
import petalFragmentShader from "./shaders/petals/fragment.glsl";
import { findInteraction, letterNumber } from "./interactions.js";

/**  -------------------------- Audio -------------------------- */

const BACKGROUND_MUSIC_VOLUME = 0.6;

const backgroundMusic = new Howl({
  src: ["/audio/music/island.mp3"],
  loop: true,
  volume: BACKGROUND_MUSIC_VOLUME,
});

const clickSound = new Howl({
  src: ["/audio/sfx/click.mp3"],
  preload: true,
  volume: 0.5,
});

let isMuted = false;

/**  -------------------------- Scene -------------------------- */

const canvas = document.querySelector("#experience-canvas");
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};
const isMobile = window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/** Sky colour per theme; the toggle tweens the scene background between them. */
const SKY_COLORS = {
  day: new THREE.Color("#A9D6F2"),
  night: new THREE.Color("#1E1B3A"),
};

const scene = new THREE.Scene();
scene.background = SKY_COLORS.day.clone();

const camera = new THREE.PerspectiveCamera(
  35,
  sizes.width / sizes.height,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ponytail: camera numbers are tuned by eye for the blockout; retune after the final model.
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 8;
controls.maxDistance = 35;
controls.minPolarAngle = 0.15 * Math.PI;
controls.maxPolarAngle = 0.62 * Math.PI;
controls.maxTargetRadius = 4;
controls.enableDamping = true;
controls.dampingFactor = 0.05;

if (isMobile) {
  camera.position.set(24, 11, 27);
  controls.target.set(0, 2.5, 0);
} else {
  camera.position.set(18, 7.5, 20.5);
  controls.target.set(0, 1.6, 0);
}
controls.update();

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**  -------------------------- Modals -------------------------- */

const modals = {
  work: document.querySelector(".modal.work"),
  about: document.querySelector(".modal.about"),
  contact: document.querySelector(".modal.contact"),
};
const overlay = document.querySelector(".overlay");

/** True while the loading screen or a modal covers the scene, so clicks and hovers pause. */
let sceneInputBlocked = true;
/** The modal on screen now, or null. */
let openModal = null;
/** Element that had focus before a modal opened, so closing gives focus back. */
let focusBeforeModal = null;

/** Opens a modal with a pop animation and moves keyboard focus into it. */
const showModal = (modal) => {
  if (openModal) return;
  openModal = modal;
  focusBeforeModal = document.activeElement;

  modal.style.display = "block";
  overlay.style.display = "block";

  sceneInputBlocked = true;
  controls.enabled = false;
  clearHover();

  gsap.set(modal, { opacity: 0, scale: 0 });
  gsap.set(overlay, { opacity: 0 });
  gsap.to(overlay, { opacity: 1, duration: 0.5 });
  gsap.to(modal, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" });

  modal.querySelector(".modal-exit-button").focus({ preventScroll: true });
};

/** Closes the open modal and gives focus back to where it was. */
const hideModal = (modal) => {
  openModal = null;
  sceneInputBlocked = false;
  controls.enabled = true;

  gsap.to(overlay, { opacity: 0, duration: 0.5 });
  gsap.to(modal, {
    opacity: 0,
    scale: 0,
    duration: 0.5,
    ease: "back.in(2)",
    onComplete: () => {
      modal.style.display = "none";
      overlay.style.display = "none";
    },
  });

  focusBeforeModal?.focus?.({ preventScroll: true });
};

overlay.addEventListener("click", () => {
  if (openModal) hideModal(openModal);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openModal) hideModal(openModal);
});

document.querySelectorAll(".modal-exit-button").forEach((button) => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    gsap.fromTo(
      button,
      { scale: 1.6 },
      {
        scale: 1,
        duration: 0.5,
        ease: "back.out(2)",
        onComplete: () => gsap.set(button, { clearProps: "all" }),
      }
    );
    clickSound.play();
    hideModal(button.closest(".modal"));
  });
});

document.querySelectorAll("[data-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    clickSound.play();
    showModal(modals[button.dataset.modal]);
  });
});

/**  -------------------------- Loading screen and intro -------------------------- */

const manager = new THREE.LoadingManager();

const loadingScreen = document.querySelector(".loading-screen");
const loadingScreenButton = document.querySelector(".loading-screen-button");
const noSoundButton = document.querySelector(".no-sound-button");

manager.onLoad = () => {
  loadingScreen.classList.add("is-ready");
  loadingScreenButton.textContent = "enter";
  loadingScreenButton.disabled = false;
  noSoundButton.textContent = "enter without sound";
  noSoundButton.hidden = false;

  let hasEntered = false;

  /** Starts the reveal once, with or without music. */
  const handleEnter = (withSound) => {
    if (hasEntered) return;
    hasEntered = true;

    noSoundButton.hidden = true;
    loadingScreenButton.textContent = "~ hey ~";
    loadingScreen.classList.add("is-entering");

    if (withSound) {
      backgroundMusic.play();
    } else {
      setMuted(true);
    }

    playReveal();
  };

  loadingScreenButton.addEventListener("click", () => handleEnter(true));
  noSoundButton.addEventListener("click", () => handleEnter(false));
};

/** Drops the loading screen away, then starts the intro. */
function playReveal() {
  const timeline = gsap.timeline();

  timeline
    .to(loadingScreen, {
      scale: 0.5,
      duration: 1.2,
      delay: 0.25,
      ease: "back.in(1.8)",
    })
    .to(
      loadingScreen,
      {
        y: "200vh",
        transform: "perspective(1000px) rotateX(45deg) rotateY(-35deg)",
        duration: 1.2,
        ease: "back.in(1.8)",
        onComplete: () => {
          sceneInputBlocked = false;
          playIntroAnimation();
          loadingScreen.remove();
        },
      },
      "-=0.1"
    );
}

/** Pops the props in, then bounces in the name letters; hitboxes appear when it ends. */
function playIntroAnimation() {
  const timeline = gsap.timeline({
    defaults: { duration: 0.4, ease: "back.out(1.8)" },
    onComplete: createDelayedHitboxes,
  });

  popInObjects.forEach((object, index) => {
    timeline.to(
      object.scale,
      { x: 1, y: 1, z: 1, duration: 0.8 },
      index === 0 ? 0 : "-=0.65"
    );
  });

  letters.filter(Boolean).forEach((letter) => {
    const restY = letter.userData.initialPosition.y;
    timeline
      .to(letter.position, { y: restY + 0.3 }, "-=0.25")
      .to(letter.scale, { x: 1, y: 1, z: 1 }, "<")
      .to(letter.position, { y: restY }, ">-0.2");
  });
}

/**  -------------------------- Loaders and materials -------------------------- */

const textureLoader = new THREE.TextureLoader(manager);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const loader = new GLTFLoader(manager);
loader.setDRACOLoader(dracoLoader);

/** Baked atlas names; each is a substring of the meshes that use it. */
const ATLASES = ["First", "Second"];
/** Phones and small tablets get the smaller (2048 px) atlases to stay inside iOS GPU limits. */
const TEXTURE_TIER =
  Math.min(screen.width, screen.height) < 768 ? "mobile" : "desktop";

/** Loads one baked atlas with the settings the bake expects. */
function loadAtlas(mode, atlas) {
  const texture = textureLoader.load(
    `/textures/island/${mode}/${atlas.toLowerCase()}_${TEXTURE_TIER}.webp`
  );
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** One day/night blend material per atlas. */
const islandMaterials = Object.fromEntries(
  ATLASES.map((atlas) => [
    atlas,
    new THREE.ShaderMaterial({
      uniforms: {
        uDayTexture: { value: loadAtlas("day", atlas) },
        uNightTexture: { value: loadAtlas("night", atlas) },
        uMixRatio: { value: 0 },
      },
      vertexShader: themeVertexShader,
      fragmentShader: themeFragmentShader,
    }),
  ])
);

/** Unlit video material for a mesh named `*Screen*`, created on first use. */
function createScreenMaterial() {
  const video = document.createElement("video");
  video.src = "/textures/video/phone.mp4";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.play();

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return new THREE.MeshBasicMaterial({ map: texture });
}

/**  -------------------------- Falling petals -------------------------- */

// ponytail: count, size and speed are eyeballed; tune on real phones.
const PETAL_COUNT = isMobile ? 120 : 300;

const petalPositions = new Float32Array(PETAL_COUNT * 3);
const petalSeeds = new Float32Array(PETAL_COUNT);
for (let i = 0; i < PETAL_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random());
  petalPositions[i * 3] = Math.cos(angle) * radius;
  petalPositions[i * 3 + 1] = Math.random();
  petalPositions[i * 3 + 2] = Math.sin(angle) * radius;
  petalSeeds[i] = Math.random();
}

const petalGeometry = new THREE.BufferGeometry();
petalGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(petalPositions, 3)
);
petalGeometry.setAttribute("aSeed", new THREE.BufferAttribute(petalSeeds, 1));

const petalMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uTop: { value: 5 },
    uFall: { value: 9 },
    uRadius: { value: 4 },
    uSize: { value: 220 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uMixRatio: { value: 0 },
  },
  vertexShader: petalVertexShader,
  fragmentShader: petalFragmentShader,
  transparent: true,
  depthWrite: false,
});

const petals = new THREE.Points(petalGeometry, petalMaterial);
// The shader moves every point, so the attribute bounds say nothing about where petals are.
petals.frustumCulled = false;
scene.add(petals);

/** Spawns petals inside the canopy and lets them fall about 4 m below the grass. */
function fitPetalsToCanopy(canopy) {
  const box = new THREE.Box3().setFromObject(canopy);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  petals.position.set(center.x, 0, center.z);
  petalMaterial.uniforms.uTop.value = center.y;
  petalMaterial.uniforms.uFall.value = center.y + 4;
  petalMaterial.uniforms.uRadius.value = (Math.max(size.x, size.z) / 2) * 0.9;
}

/**  -------------------------- Model -------------------------- */

/** Mesh-name prefixes that scale in during the intro. */
const objectsWithIntroAnimations = [
  "Phone",
  "Paper_Airplane",
  "Writing_",
  "Robot_Hand",
  "Stone_",
  "Minecraft_Block",
];

/** Name letters in N order; the count comes from the model. */
const letters = [];
/** Props that pop in before the letters. */
const popInObjects = [];
/** Interactive meshes that get hitboxes once the intro ends. */
const objectsNeedingHitboxes = [];

function hasIntroAnimation(objectName) {
  return objectsWithIntroAnimations.some((animatedName) =>
    objectName.includes(animatedName)
  );
}

loader.load("/models/island.glb", (glb) => {
  glb.scene.traverse((child) => {
    if (!child.isMesh) return;

    if (child.name.includes("Hover")) {
      child.userData.initialScale = child.scale.clone();
      child.userData.initialPosition = child.position.clone();
    }

    const letterIndex = letterNumber(child.name);
    if (letterIndex) {
      letters[letterIndex - 1] = child;
      child.scale.set(0, 0, 0);
    } else if (hasIntroAnimation(child.name)) {
      popInObjects.push(child);
      child.scale.set(0, 0, 0);
    }

    if (child.name.includes("Canopy")) {
      fitPetalsToCanopy(child);
    }

    if (child.name.includes("Screen")) {
      child.material = createScreenMaterial();
    } else {
      const atlas = ATLASES.find((name) => child.name.includes(name));
      if (atlas) child.material = islandMaterials[atlas];
    }

    if (child.name.includes("Raycaster")) {
      if (letterIndex || hasIntroAnimation(child.name)) {
        objectsNeedingHitboxes.push(child);
      } else {
        addHitbox(child);
      }
    }
  });

  scene.add(glb.scene);
});

/**  -------------------------- Hitboxes, hover and clicks -------------------------- */

const raycaster = new THREE.Raycaster();
// Start off-screen so nothing is hovered before the first pointer move.
const pointer = new THREE.Vector2(10, 10);
const raycasterObjects = [];
const hitboxToObjectMap = new Map();
let currentIntersects = [];
let currentHoveredObject = null;

/**
 * Adds an invisible box around an object; boxes are steadier to hover than the
 * real mesh, which jitters while its hover animation runs.
 */
function addHitbox(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 1.1, size.y * 1.75, size.z * 1.1),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.copy(center);
  hitbox.name = object.name + "_Hitbox";
  hitbox.userData.labelAnchor = new THREE.Vector3(center.x, box.max.y, center.z);

  scene.add(hitbox);
  raycasterObjects.push(hitbox);
  hitboxToObjectMap.set(hitbox, object);
}

function createDelayedHitboxes() {
  objectsNeedingHitboxes.forEach(addHitbox);
  objectsNeedingHitboxes.length = 0;
}

/** Plays the click sound and runs the object's action: open a link or a modal. */
function runInteraction(hitbox) {
  const object = hitboxToObjectMap.get(hitbox);
  const action = object && findInteraction(object.name);
  if (!action) return;

  clickSound.play();
  if (action.url) {
    window.open(action.url, "_blank", "noopener,noreferrer");
  } else {
    showModal(modals[action.modal]);
  }
}

/** Hover scale per object; the lying figure only breathes, stones barely grow. */
function hoverScaleFor(objectName) {
  if (objectName.includes("Anu_Figure")) return 1.05;
  if (objectName.includes("Stone_")) return 1.15;
  return 1.3;
}

/** Objects that lift on hover instead of only growing. */
function liftsOnHover(objectName) {
  return objectName.includes("Name_Letter") || objectName.includes("Stone_");
}

/** Grows (and for some objects lifts) an object on hover, and puts it back after. */
function playHoverAnimation(hitbox, isHovering) {
  const object = hitboxToObjectMap.get(hitbox);
  const { initialScale, initialPosition } = object.userData;
  const scale = isHovering ? hoverScaleFor(object.name) : 1;
  const tween = { duration: isHovering ? 0.5 : 0.3, ease: "back.out(2)" };

  gsap.killTweensOf(object.scale);
  gsap.killTweensOf(object.position);

  gsap.to(object.scale, {
    x: initialScale.x * scale,
    y: initialScale.y * scale,
    z: initialScale.z * scale,
    ...tween,
  });

  if (liftsOnHover(object.name)) {
    gsap.to(object.position, {
      y: initialPosition.y + (isHovering ? 0.2 : 0),
      ...tween,
    });
  }
}

/** Ends any hover and resets the cursor; used when a modal opens. */
function clearHover() {
  if (currentHoveredObject) {
    playHoverAnimation(currentHoveredObject, false);
    currentHoveredObject = null;
  }
  document.body.style.cursor = "default";
  currentIntersects = [];
}

/** Raycasts from the pointer and starts or ends hover animations. */
function updateHover() {
  raycaster.setFromCamera(pointer, camera);
  currentIntersects = raycaster.intersectObjects(raycasterObjects);

  const hitbox = currentIntersects[0]?.object;
  if (!hitbox) {
    clearHover();
    return;
  }

  if (hitbox.name.includes("Hover") && hitbox !== currentHoveredObject) {
    if (currentHoveredObject) playHoverAnimation(currentHoveredObject, false);
    currentHoveredObject = hitbox;
    playHoverAnimation(hitbox, true);
  }

  document.body.style.cursor = hitbox.name.includes("Pointer")
    ? "pointer"
    : "default";
}

const objectLabel = document.querySelector(".object-label");
const labelPosition = new THREE.Vector3();

/** Keeps the hover label above the hovered object, or hides it. */
function updateLabel() {
  if (!currentHoveredObject || sceneInputBlocked) {
    objectLabel.classList.remove("is-visible");
    return;
  }

  const object = hitboxToObjectMap.get(currentHoveredObject);
  const text = findInteraction(object.name)?.label ?? "";
  if (objectLabel.textContent !== text) objectLabel.textContent = text;

  labelPosition.copy(currentHoveredObject.userData.labelAnchor).project(camera);
  const x = ((labelPosition.x + 1) / 2) * sizes.width;
  const y = ((1 - labelPosition.y) / 2) * sizes.height;
  objectLabel.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
  objectLabel.classList.add("is-visible");
}

/** Where the last press started, so a camera drag does not count as a click. */
const pressPoint = { x: 0, y: 0 };
let pressMoved = false;
/** First tap on touch selects an object; a second tap on the same one runs it. */
let lastTappedHitbox = null;

function setPointer(e) {
  pointer.x = (e.clientX / sizes.width) * 2 - 1;
  pointer.y = -(e.clientY / sizes.height) * 2 + 1;
}

canvas.addEventListener("pointerdown", (e) => {
  setPointer(e);
  pressPoint.x = e.clientX;
  pressPoint.y = e.clientY;
  pressMoved = false;
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") setPointer(e);
  if (Math.hypot(e.clientX - pressPoint.x, e.clientY - pressPoint.y) > 6) {
    pressMoved = true;
  }
});

canvas.addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse") pointer.set(10, 10);
});

canvas.addEventListener("click", () => {
  if (sceneInputBlocked || pressMoved) return;
  const hitbox = currentIntersects[0]?.object;
  if (hitbox) runInteraction(hitbox);
});

canvas.addEventListener(
  "touchend",
  (e) => {
    // Stops the browser's emulated click, which would run the action a second time.
    e.preventDefault();
    if (sceneInputBlocked || pressMoved) return;

    raycaster.setFromCamera(pointer, camera);
    const hitbox = raycaster.intersectObjects(raycasterObjects)[0]?.object;
    if (hitbox && hitbox === lastTappedHitbox) {
      lastTappedHitbox = null;
      runInteraction(hitbox);
    } else {
      lastTappedHitbox = hitbox ?? null;
    }
  },
  { passive: false }
);

/**  -------------------------- Sound and theme toggles -------------------------- */

const themeToggleButton = document.querySelector(".theme-toggle-button");
const muteToggleButton = document.querySelector(".mute-toggle-button");
const sunSvg = document.querySelector(".sun-svg");
const moonSvg = document.querySelector(".moon-svg");
const soundOffSvg = document.querySelector(".sound-off-svg");
const soundOnSvg = document.querySelector(".sound-on-svg");

/** Mutes or unmutes every sound and syncs the button icon. */
function setMuted(muted) {
  isMuted = muted;
  Howler.mute(muted);
  soundOnSvg.style.display = muted ? "none" : "block";
  soundOffSvg.style.display = muted ? "block" : "none";
  muteToggleButton.setAttribute("aria-pressed", String(muted));
}

/** Gives a toggle button its spin-and-settle feedback. */
function bounceToggle(button, rotate) {
  gsap.fromTo(
    button,
    { rotate, scale: 1.6 },
    {
      rotate: 0,
      scale: 1,
      duration: 0.5,
      ease: "back.out(2)",
      onComplete: () => gsap.set(button, { clearProps: "all" }),
    }
  );
}

muteToggleButton.addEventListener("click", () => {
  setMuted(!isMuted);
  clickSound.play();
  if (!backgroundMusic.playing()) backgroundMusic.play();
  bounceToggle(muteToggleButton, -45);
});

let isNightMode = false;

themeToggleButton.addEventListener("click", () => {
  isNightMode = !isNightMode;
  document.body.classList.toggle("dark-theme", isNightMode);
  document.body.classList.toggle("light-theme", !isNightMode);
  sunSvg.style.display = isNightMode ? "none" : "block";
  moonSvg.style.display = isNightMode ? "block" : "none";
  themeToggleButton.setAttribute("aria-pressed", String(isNightMode));

  clickSound.play();
  bounceToggle(themeToggleButton, 45);

  const mixTween = {
    value: isNightMode ? 1 : 0,
    duration: 1.5,
    ease: "power2.inOut",
  };
  [...Object.values(islandMaterials), petalMaterial].forEach((material) => {
    gsap.to(material.uniforms.uMixRatio, mixTween);
  });

  const sky = SKY_COLORS[isNightMode ? "night" : "day"];
  gsap.to(scene.background, {
    r: sky.r,
    g: sky.g,
    b: sky.b,
    duration: 1.5,
    ease: "power2.inOut",
  });
});

/**  -------------------------- Render loop -------------------------- */

const clock = new THREE.Clock();

const render = () => {
  // Reduced motion freezes the petals in place instead of hiding them.
  if (!prefersReducedMotion) {
    petalMaterial.uniforms.uTime.value = clock.getElapsedTime();
  }

  controls.update();

  if (!sceneInputBlocked) updateHover();
  updateLabel();

  renderer.render(scene, camera);
  window.requestAnimationFrame(render);
};

render();
