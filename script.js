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
   IMAGE PRELOAD
===================================================== */

let loaded = 0;
const total = images.length;

let loaderFinished = false;

function incrementLoader() {
  if (loaderFinished) return;

  loaded++;
  loaderBar.style.width = `${(loaded / total) * 100}%`;

  if (loaded >= total) {
    finishLoader();
  }
}

function finishLoader() {
  
  console.log("FINISH LOADER CALLED");
  if (loaderFinished) return;

  loaderFinished = true;

  loaderBar.style.width = "100%";

  setTimeout(() => {
    loader.classList.add("hidden");
  }, 400);
}

images.forEach(img => {
  if (img.complete && img.naturalWidth !== 0) {
    incrementLoader();
  } else {
    img.addEventListener("load", incrementLoader);
    img.addEventListener("error", incrementLoader);
  }
});

/* 🔒 absolute safety — never hang */
setTimeout(finishLoader, 2500);


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

let storedScale = 1;
let storedOriginX = 0;
let storedOriginY = 0;


/* =====================================================
   DESKTOP SMOOTH WHEEL STATE
===================================================== */

let smoothWheel = 0;
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

viewport.addEventListener("mousemove", e => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

/* =====================================================
   CLAMP PAN/BORDER
===================================================== */

const WORLD_SCALE = 1.6;
const PAN_MARGIN_DESKTOP = 260;
const PAN_MARGIN_MOBILE  = 180;

function clampPanTargets() {

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  const worldW = viewW * WORLD_SCALE * scale;
  const worldH = viewH * WORLD_SCALE * scale;

  const margin = IS_MOBILE
    ? PAN_MARGIN_MOBILE
    : PAN_MARGIN_DESKTOP;

  const limitX = (worldW - viewW) / 2 + margin;
  const limitY = (worldH - viewH) / 2 + margin;

  targetOriginX = Math.max(
    CAMERA_CENTER_X - limitX,
    Math.min(CAMERA_CENTER_X + limitX, targetOriginX)
  );

  targetOriginY = Math.max(
    CAMERA_CENTER_Y - limitY,
    Math.min(CAMERA_CENTER_Y + limitY, targetOriginY)
  );
}



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
  scale   += (targetScale - scale) * ZOOM_EASE;

  applyTransform();
  requestAnimationFrame(cameraLoop);
}

cameraLoop();

/* =====================================================
   DESKTOP WHEEL INPUT
===================================================== */

viewport.addEventListener("wheel", e => {
  if (IS_MOBILE || activeProject || cameraLocked) return;
  e.preventDefault();
  smoothWheel += e.deltaY;
}, { passive: false });


/* =====================================================
   MOBILE PINCH ZOOM  ✅ RESTORED WORKING VERSION
===================================================== */

let pinchActive = false;
let pinchLock = false;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let pinchStartOriginX = 0;
let pinchStartOriginY = 0;

viewport.addEventListener("touchstart", e => {

  if (!IS_MOBILE) return;

  if (e.touches.length === 2) {

    pinchActive = true;
    pinchLock = true;

    const a = e.touches[0];
    const b = e.touches[1];

    pinchStartDistance = Math.hypot(
      a.clientX - b.clientX,
      a.clientY - b.clientY
    );

    pinchStartScale = scale;
    pinchStartOriginX = originX;
    pinchStartOriginY = originY;
  }
}, { passive: false });


viewport.addEventListener("touchmove", e => {

  if (!pinchActive || e.touches.length !== 2 || cameraLocked) return;

  e.preventDefault();

  const a = e.touches[0];
  const b = e.touches[1];

  const dist = Math.hypot(
    a.clientX - b.clientX,
    a.clientY - b.clientY
  );

  const zoom = dist / pinchStartDistance;

  const midX = (a.clientX + b.clientX) / 2;
  const midY = (a.clientY + b.clientY) / 2;

  const worldX = (midX - pinchStartOriginX) / pinchStartScale;
  const worldY = (midY - pinchStartOriginY) / pinchStartScale;

 const newScale = Math.min(
  Math.max(pinchStartScale * zoom, MIN_SCALE),
  MAX_SCALE
);

scale = newScale;

originX = midX - worldX * scale;
originY = midY - worldY * scale;

targetScale = scale;
targetOriginX = originX;
targetOriginY = originY;


}, { passive: false });


viewport.addEventListener("touchend", e => {

  if (pinchActive && e.touches.length < 2) {

    pinchActive = false;

    setTimeout(() => {
      pinchLock = false;
    }, 60);
  }
});


/* =====================================================
   PAN
===================================================== */

viewport.addEventListener("mousedown", e => {

  if (IS_MOBILE) return;
  if (activeProject || cameraLocked) return;
  if (e.target.classList.contains("image")) return;
  smoothWheel = 0;


  const startX = e.clientX - targetOriginX;
  const startY = e.clientY - targetOriginY;

  function move(ev) {
    targetOriginX = ev.clientX - startX;
    targetOriginY = ev.clientY - startY;
  }

  function up() {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
});


/* =====================================================
   INITIAL IMAGE SETUP
===================================================== */

const originals = [];

const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;

images.forEach(img => {

  const x = (Math.random() - 0.5) * window.innerWidth;
  const y = (Math.random() - 0.5) * window.innerHeight;

  img._x = x;
  img._y = y;
  img._tx = x;
  img._ty = y;

  originals.push({ img, x, y });


  img._vx = (Math.random() - 0.5) * 0.12;
  img._vy = (Math.random() - 0.5) * 0.12;

  img._floating = true;

  img.style.transform =
    `translate(${x}px, ${y}px) translate(-50%, -50%)`;
});


/* =====================================================
   FLOATING MOTION
===================================================== */

function floatImages() {

  if (!activeProject || IS_MOBILE) {

    images.forEach(img => {
      if (!img._floating) return;

      img._tx += img._vx;
      img._ty += img._vy;

      const m = 80;

      const maxX = window.innerWidth  * 1.6 - m;
      const maxY = window.innerHeight * 1.6 - m;

      if (img._tx < m || img._tx > maxX) img._vx *= -1;
      if (img._ty < m || img._ty > maxY) img._vy *= -1;

      img._x += (img._tx - img._x) * 0.02;
      img._y += (img._ty - img._y) * 0.02;

      img.style.transform =
        `translate(${img._x}px, ${img._y}px) translate(-50%, -50%)`;
    });
  }

  requestAnimationFrame(floatImages);
}

floatImages();


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

  // 🛑 kill zoom momentum immediately
  smoothWheel = 0;

  // ⛔️ prevent re-entry FIRST
  if (cameraLocked) return;
  cameraLocked = true;

  // 🔒 finalize camera if zoom is mid-flight (single-frame sync)
  originX = targetOriginX;
  originY = targetOriginY;
  scale   = targetScale;

  storedScale = targetScale;
  storedOriginX = targetOriginX;
  storedOriginY = targetOriginY;

  activeProject = project;

  images.forEach(img => {
    img.style.opacity =
      img.dataset.project === project ? "1" : "0.15";
    img._floating = img.dataset.project !== project;
  });

  /* Zoom out slightly like original */
  targetScale = 0.7;

  setTimeout(() => {

    const groupImages =
      images.filter(i => i.dataset.project === project);

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

    const density =
      Math.min(Math.max(COUNT / 14, 0.8), 2.2);

    const SPACING =
      (IMAGE_SIZE + MIN_GAP) / density;

    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

    groupImages.forEach((img, i) => {

      img.style.width = IMAGE_SIZE + "px";

      const angle = i * GOLDEN_ANGLE;
      const t = i / COUNT;

      const spiralRadius = Math.sqrt(i) * SPACING;
      const linearRadius = t * MAX_RADIUS;

      const radius = Math.min(
        spiralRadius * 0.4 +
        linearRadius * 0.6,
        MAX_RADIUS
      );

      const x = CENTER_X + Math.cos(angle) * radius;
      const y = CENTER_Y + Math.sin(angle) * radius;

      img._x = x;
      img._y = y;
      img._tx = x;
      img._ty = y;

      img.style.zIndex = 3000 - i;
      img.style.transition = "transform 0.5s ease";
      img.style.transform =
        `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });

    /* ==========================================
       CAMERA FRAMES GROUP — STABLE SCREEN ANCHOR
    ========================================== */

	// 🔒 hard anchor: CENTER-LEFT of screen (never center)
	const screenAnchorX = window.innerWidth  * 0.35; // ← adjust if needed
	const screenAnchorY = window.innerHeight * 0.5;

	targetScale = 1;
	targetOriginX = screenAnchorX - CENTER_X;
	targetOriginY = screenAnchorY - CENTER_Y;


    setTimeout(() => {

      descriptions.classList.add("visible");

      Array.from(descriptions.children).forEach(desc => {
        desc.style.display =
          desc.dataset.project === project ? "block" : "none";
      });

      cameraLocked = false;

    }, 420);

  }, 520);
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
    img.style.zIndex = 3000;

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
      img.releasePointerCapture(ev.pointerId);
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerup", onUp);
    }

    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerup", onUp);
  });
});

/* =====================================================
   DRAGGABLE PROJECT DESCRIPTION
===================================================== */

let descDragging = false;
let offsetX = 0;
let offsetY = 0;

descriptions.addEventListener("pointerdown", e => {

  if (!descriptions.classList.contains("visible")) return;

  if (
    e.target.tagName === "P" ||
    e.target.tagName === "STRONG" ||
    e.target.tagName === "A"
  ) return;

  const rect = descriptions.getBoundingClientRect();

  descDragging = true;

  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  descriptions.setPointerCapture(e.pointerId);
  descriptions.style.cursor = "grabbing";

  e.preventDefault();
});

window.addEventListener("pointermove", e => {
  if (!descDragging) return;

  descriptions.style.left = `${e.clientX - offsetX}px`;
  descriptions.style.top  = `${e.clientY - offsetY}px`;
});

window.addEventListener("pointerup", e => {
  if (!descDragging) return;

  descDragging = false;
  descriptions.releasePointerCapture(e.pointerId);
  descriptions.style.cursor = "grab";
});



/* =====================================================
   ESC RESTORE
===================================================== */

window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;

  activeProject = null;
  descriptions.classList.remove("visible");

  images.forEach(img => {
    img._floating = true;
    img.style.opacity = "1";
    img.style.zIndex = 1;
    img.style.width = "100px";
  });

  originals.forEach(o => {
    o.img._x = o.x;
    o.img._y = o.y;
    o.img._tx = o.x;
    o.img._ty = o.y;
    o.img.style.transform =
      `translate(${o.x}px, ${o.y}px) translate(-50%, -50%)`;
  });

  targetScale = storedScale;
  targetOriginX = storedOriginX;
  targetOriginY = storedOriginY;
});

/* =====================================================
   ABOUT PANEL
===================================================== */

const aboutBtn = document.getElementById("about-btn");
const aboutPanel = document.getElementById("about-panel");

aboutBtn.addEventListener("click", () => {
  aboutPanel.hidden = false;
  aboutPanel.classList.toggle("visible");
});



/* =====================================================
   MOBILE ONE-FINGER PAN
===================================================== */


let lastTouchX = null;
let lastTouchY = null;

viewport.addEventListener("touchstart", e => {

  if (!IS_MOBILE) return;
  if (pinchLock) return;
  if (e.touches.length !== 1) return;

  lastTouchX = e.touches[0].clientX;
  lastTouchY = e.touches[0].clientY;
});


viewport.addEventListener("touchmove", e => {

  if (!IS_MOBILE) return;
  if (pinchLock) return;
  if (e.touches.length !== 1) return;

  e.preventDefault();

  const t = e.touches[0];

  const dx = t.clientX - lastTouchX;
  const dy = t.clientY - lastTouchY;

  targetOriginX += dx;
  targetOriginY += dy;

  lastTouchX = t.clientX;
  lastTouchY = t.clientY;

}, { passive: false });


viewport.addEventListener("touchend", () => {
  lastTouchX = null;
  lastTouchY = null;
});



/* =====================================================
   MOBILE STACKED PROJECT VIEW (ADDED)
===================================================== */

const mobileProject = document.getElementById("mobile-project");
const mobileStack = document.getElementById("mobile-stack");
const mobileExit = document.getElementById("mobile-exit");

function openMobileGroup(project) {

  activeProject = project;
  mobileStack.innerHTML = "";

  const groupImages =
    images.filter(i => i.dataset.project === project);

  const description =
    Array.from(descriptions.children)
      .find(d => d.dataset.project === project);

  mobileStack.appendChild(groupImages[0].cloneNode());

  if (description) {
    mobileStack.appendChild(description.cloneNode(true));
  }

  groupImages.slice(1).forEach(img => {
    mobileStack.appendChild(img.cloneNode());
  });

  mobileProject.hidden = false;
}

mobileExit.addEventListener("click", () => {
  mobileProject.hidden = true;
  mobileStack.innerHTML = "";
  activeProject = null;
});