console.log("SCRIPT START");

/* =====================================================
   MOBILE FLAG
===================================================== */

const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches;

let cameraLocked = false;

/* =====================================================
   DOM QUERIES
===================================================== */

const viewport = document.getElementById("viewport");
const canvas = document.getElementById("canvas");

const allImages = Array.from(document.querySelectorAll(".image"));
const logo = document.getElementById("loader-logo");

// everything except the logo
const images = allImages.filter(img => img !== logo);

const descriptions = document.getElementById("project-descriptions");

const loader = document.getElementById("loader");
const loaderBar = document.querySelector(".loader-progress");

/* =====================================================
   IMAGE PRELOAD (ROBUST)
===================================================== */

let loaded = 0;
let loaderFinished = false;

// include logo + canvas images
const preloadImages = [logo, ...images];
const total = preloadImages.length;

function incrementLoader() {
  if (loaderFinished) return;
  loaded++;

  loaderBar.style.width = `${(loaded / total) * 100}%`;

  if (loaded >= total) {
    finishLoader();
  }
}

function finishLoader() {
  if (loaderFinished) return;
  loaderFinished = true;

  loaderBar.style.width = "100%";

  setTimeout(() => {
    loader.classList.add("hidden");
  }, 400);
}

// preload everything
preloadImages.forEach(img => {
  if (img.complete && img.naturalWidth > 0) {
    incrementLoader();
  } else {
    img.addEventListener("load", incrementLoader, { once: true });
    img.addEventListener("error", incrementLoader, { once: true });
  }
});

/* =====================================================
   CAMERA STATE
===================================================== */

let originX = 0;
let originY = 0;
let scale = 1;

let targetOriginX = 0;
let targetOriginY = 0;
let targetScale = 1;

originX = window.innerWidth / 2;
originY = window.innerHeight / 2;

targetOriginX = originX;
targetOriginY = originY;

const CAMERA_CENTER_X = originX;
const CAMERA_CENTER_Y = originY;

const MIN_SCALE = IS_MOBILE ? 0.9 : 0.7;
const MAX_SCALE = IS_MOBILE ? 3.0 : 2.0;

const PAN_EASE = 0.07;
const ZOOM_EASE = 0.05;

let activeProject = null;
let topZ = 4000;

let storedScale = 1;
let storedOriginX = 0;
let storedOriginY = 0;

/* =====================================================
   CAMERA LOOP
===================================================== */

function applyTransform() {
  canvas.style.transform =
    `translate(${originX}px, ${originY}px) scale(${scale})`;
}

function cameraLoop() {
  /* desktop smooth zoom */
  if (!IS_MOBILE && Math.abs(smoothWheel) > 0.05) {
    const delta = smoothWheel * 0.12;
    smoothWheel *= 0.94;

    const worldX = (lastMouseX - originX) / scale;
    const worldY = (lastMouseY - originY) / scale;

    const zoom = Math.exp(-delta * 0.0015);

    const newScale = Math.min(
      Math.max(scale * zoom, MIN_SCALE),
      MAX_SCALE
    );

    scale = newScale;

    originX = lastMouseX - worldX * scale;
    originY = lastMouseY - worldY * scale;

    targetScale = scale;
    targetOriginX = originX;
    targetOriginY = originY;
  }

  clampPanTargets();

  /* camera easing */
  originX += (targetOriginX - originX) * PAN_EASE;
  originY += (targetOriginY - originY) * PAN_EASE;
  scale += (targetScale - scale) * ZOOM_EASE;

  applyTransform();
  requestAnimationFrame(cameraLoop);
}

cameraLoop();

/* =====================================================
   IMAGE CLICK
===================================================== */

images.forEach(img => {
  img.addEventListener("click", e => {
    e.stopPropagation();

    if (IS_MOBILE) {
      openMobileGroup(img.dataset.project);
      return;
    }

    if (activeProject) return;
    activateGroup(img.dataset.project);
  });
});

/* =====================================================
   GROUP LOGIC — LEFT SIDE ADAPTIVE SPIRAL (FIXED)
===================================================== */

function activateGroup(project) {
  topZ = 4000; // reset stacking for new group

  // 🛑 kill zoom momentum immediately
  smoothWheel = 0;

  // ⛔️ prevent re-entry FIRST
  if (cameraLocked) return;
  cameraLocked = true;

  // 🔒 finalize camera if zoom is mid-flight (single-frame sync)
  originX = targetOriginX;
  originY = targetOriginY;
  scale = targetScale;

  storedScale = targetScale;
  storedOriginX = targetOriginX;
  storedOriginY = targetOriginY;

  activeProject = project;

  images.forEach(img => {
    img.style.opacity = img.dataset.project === project ? "1" : "0.15";
    img._floating = img.dataset.project !== project;
  });

  /* Zoom out slightly like original */
  targetScale = 0.7;

  // Immediately show the description after the group is activated
  descriptions.classList.add("visible");
  Array.from(descriptions.children).forEach(desc => {
    desc.style.display = desc.dataset.project === project ? "block" : "none";
  });

  setTimeout(() => {
    const groupImages = images.filter(i => i.dataset.project === project);
    const COUNT = groupImages.length;
    const IMAGE_SIZE = 320;
    const MIN_GAP = 40;

    /* WORLD SPACE — NOT CAMERA SPACE */
    const CENTER_X = -window.innerWidth * 0.4;
    const CENTER_Y = 0;

    const MAX_RADIUS = Math.min(
      window.innerWidth * 0.28,
      window.innerHeight * 0.45
    );

    const density = Math.min(Math.max(COUNT / 14, 0.8), 2.2);
    const SPACING = (IMAGE_SIZE + MIN_GAP) / density;
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

    // **Delayed Image Formation**
    setTimeout(() => {
      groupImages.forEach((img, i) => {
        img.style.width = IMAGE_SIZE + "px";

        const angle = i * GOLDEN_ANGLE;
        const t = i / COUNT;

        const spiralRadius = Math.sqrt(i) * SPACING;
        const linearRadius = t * MAX_RADIUS;

        const radius = Math.min(
          spiralRadius * 0.4 + linearRadius * 0.6,
          MAX_RADIUS
        );

        const x = CENTER_X + Math.cos(angle) * radius;
        const y = CENTER_Y + Math.sin(angle) * radius;

        img._x = x;
        img._y = y;
        img._tx = x;
        img._ty = y;

        img.style.zIndex = topZ - i;
        img.style.transition = "transform 1s ease"; // Slow down image formation
        img.style.transform =
          `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      });
    }, 400); // Delay image formation for 1 second

    // Camera Frame Group Transition — stable screen anchor
    const screenAnchorX = window.innerWidth * 0.28;
    const screenAnchorY = window.innerHeight * 0.5;

    targetScale = 1;
    targetOriginX = screenAnchorX - CENTER_X;
    targetOriginY = screenAnchorY - CENTER_Y;

    // Slower zoom-in transition with easing
    let progress = 0;
    let zoomDuration = 1500; // 1.5 seconds for smoother zoom-in

    function cameraLoop() {
      if (progress < zoomDuration) {
        progress++;
        let t = progress / zoomDuration;
        let easingFactor = easeInOutQuad(t);

        originX += (targetOriginX - originX) * easingFactor;
        originY += (targetOriginY - originY) * easingFactor;
        scale += (targetScale - scale) * easingFactor;
      }

      applyTransform();
      requestAnimationFrame(cameraLoop);
    }

    cameraLoop(); // Start the camera animation

    // Unlock the camera after the zoom-in transition is finished
    setTimeout(() => {
      cameraLocked = false;
    }, zoomDuration);
  }, 800); // Initial delay for zoom-out and image formation
}

/* =====================================================
   DRAGGING — GROUP ONLY
===================================================== */

images.forEach(img => {
  img.addEventListener("pointerdown", e => {

    if (!activeProject) return;
    if (img.dataset.project !== activeProject) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    img.setPointerCapture(e.pointerId);
    // 🚀 disable smoothing during drag
    img.style.transition = "none";
    img.style.zIndex = ++topZ;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const startX = img._x;
    const startY = img._y;

    function onMove(ev) {
      const dx = (ev.clientX - startMouseX) / scale;
      const dy = (ev.clientY - startMouseY) / scale;

      img._x = startX + dx;
      img._y = startY + dy;

      img._tx = img._x;
      img._ty = img._y;

      img.style.transform =
        `translate(${img._x}px, ${img._y}px) translate(-50%, -50%)`;
    }

    function onUp(ev) {
      // restore smooth transitions
      img.style.transition = "transform 0.5s ease";  
      img.releasePointerCapture(ev.pointerId);
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerup", onUp);
    }

    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerup", onUp);
  });
});
