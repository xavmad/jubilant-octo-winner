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
   IMAGE PRELOAD (ROBUST) — Updated to wait for logo first
===================================================== */

let loaded = 0;
let loaderFinished = false;

// First load the logo, then proceed with other images
const preloadImages = [logo, ...images];
const total = preloadImages.length;

// Function to update the loader progress bar
function incrementLoader() {
  if (loaderFinished) return;

  loaded++;

  // Update the loader bar width based on images loaded
  loaderBar.style.width = `${(loaded / total) * 100}%`;

  if (loaded >= total) {
    finishLoader();
  }
}

// Function to finish loader animation
function finishLoader() {
  if (loaderFinished) return;
  loaderFinished = true;

  loaderBar.style.width = "100%";

  setTimeout(() => {
    loader.classList.add("hidden"); // Hide loader after a delay
  }, 400);
}

// Preload the logo image first, then other images
const logoImage = new Image();
logoImage.src = logo.src; // Assign the logo image source

logoImage.onload = () => {
  // After the logo is loaded, update the loader bar and start loading other images
  incrementLoader();
  
  preloadImages.forEach(img => {
    if (img.complete && img.naturalWidth > 0) {
      incrementLoader(); // If already loaded, increment immediately
    } else {
      img.addEventListener("load", incrementLoader, { once: true });
      img.addEventListener("error", incrementLoader, { once: true });
    }
  });
};


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

let cameraPaused = false;  // Flag to pause camera loop during group zoom
let applyingTransform = false;  // Flag to stop applying global camera transform during zoom



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

// Ensure that we apply the correct target values after a pan or zoom
function applyTransform() {
  if (applyingTransform) return;

  canvas.style.transform =
    `translate(${targetOriginX}px, ${targetOriginY}px) scale(${targetScale})`;
}

// Camera loop to handle smooth transitions between pan and zoom
let isPanning = false;  // Flag to track if the camera is currently panning

// Initialization function to set the camera state on load
function initializeCamera() {
  // Initial camera position and scale setup
  originX = CAMERA_CENTER_X;
  originY = CAMERA_CENTER_Y;
  scale = 1;

  targetOriginX = originX;
  targetOriginY = originY;
  targetScale = scale;

  // Apply the initial transform immediately after initialization
  applyTransform();
}

// Camera loop to handle smooth transitions
function cameraLoop() {
  if (cameraPaused) return;

  // Handle zooming: calculate the scale factor and adjust origin
  if (Math.abs(smoothWheel) > 0.001) {
    const delta = smoothWheel * 0.12;
    smoothWheel *= 0.92; // smooth out wheel momentum

    const oldScale = scale;
    const zoom = Math.exp(-delta * 0.0015);
    scale = Math.min(Math.max(scale * zoom, MIN_SCALE), MAX_SCALE);
    targetScale = scale;

    // Adjust camera origin so zoom is under mouse cursor
    const worldX = (lastMouseX - targetOriginX) / oldScale;
    const worldY = (lastMouseY - targetOriginY) / oldScale;

    targetOriginX = lastMouseX - worldX * scale;
    targetOriginY = lastMouseY - worldY * scale;
  }
  
    clampPanTargets();


  // Smooth interpolation for camera position and scale
  originX += (targetOriginX - originX) * PAN_EASE;
  originY += (targetOriginY - originY) * PAN_EASE;
  scale += (targetScale - scale) * ZOOM_EASE;

  // Apply the updated transform
  applyTransform();

  requestAnimationFrame(cameraLoop);  // Continue the loop
}

// Mouse down for pan initiation
viewport.addEventListener("mousedown", e => {
  if (IS_MOBILE) return;
  if (activeProject || cameraLocked) return;
  if (e.target.classList.contains("image")) return;

  smoothWheel = 0;
  isPanning = true;  // Set the pan flag to true

  const startX = e.clientX - targetOriginX;
  const startY = e.clientY - targetOriginY;

  function onMouseMove(ev) {
    targetOriginX = ev.clientX - startX;
    targetOriginY = ev.clientY - startY;
  }

  function onMouseUp() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    isPanning = false;  // Stop panning
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
});

// Initialize the camera state and start the loop on page load
initializeCamera();
cameraLoop(); // Start the loop immediately after initialization





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

// World size is still large (1.6 times the viewport)
const worldScaleX = window.innerWidth * 1.6;  // 1.6 times the viewport width
const worldScaleY = window.innerHeight * 1.6; // 1.6 times the viewport height

// Boundary size is 1.2 times the world size
const boundaryScaleX = worldScaleX * 1.2;  // 1.2 times the world width
const boundaryScaleY = worldScaleY * 1.2; // 1.2 times the world height

const worldCenterX = worldScaleX / 2;  // Center of the world horizontally
const worldCenterY = worldScaleY / 2;  // Center of the world vertically

images.forEach(img => {
  // Random initial position for each image, but we limit it to the visible area of the viewport
  const x = (Math.random() - 0.5) * window.innerWidth;  // Random position within the viewport width
  const y = (Math.random() - 0.5) * window.innerHeight; // Random position within the viewport height

  // Initialize the image's position data
  img._x = x;
  img._y = y;
  img._tx = x;
  img._ty = y;

  // Push original data for reference
  originals.push({ img, x, y });

  // Random velocity for floating motion in both directions
  img._vx = (Math.random() - 0.5) * 0.12; // Horizontal movement (left/right)
  img._vy = (Math.random() - 0.5) * 0.12; // Vertical movement (up/down)

  // Ensure the image is set to float
  img._floating = true;

  // Update the transform style to set the position of the image
  img.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
});

/* =====================================================
   FLOATING MOTION WITH CORRECT BOUNDARY
===================================================== */

function floatImages() {
  if (!activeProject || IS_MOBILE) {
    // Get viewport size
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    const worldW = viewW * 1.6;  // 1.6 times the viewport width (world size)
    const worldH = viewH * 1.6; // 1.6 times the viewport height (world size)

    const boundaryW = worldW * 1.2;  // 1.2 times the world width (boundary size)
    const boundaryH = worldH * 1.2; // 1.2 times the world height (boundary size)

    images.forEach(img => {
      if (!img._floating) return; // Only update floating images

      // Update the image's target position based on its velocity
      img._tx += img._vx;
      img._ty += img._vy;

      // Smooth the image's position change
      img._x += (img._tx - img._x) * 0.02;
      img._y += (img._ty - img._y) * 0.02;

      // Apply boundary constraints after the update — roaming within the 1.2 times the world size
      // If image goes out of bounds, flip its velocity to make it float back inside the boundary
      if (img._tx < -boundaryW / 2 || img._tx > boundaryW / 2) img._vx *= -1;
      if (img._ty < -boundaryH / 2 || img._ty > boundaryH / 2) img._vy *= -1;

      // Apply the updated position to the image, with respect to the world center
      img.style.transform = `translate(${img._x}px, ${img._y}px) translate(-50%, -50%)`;
    });
  }

  // Continue the animation loop
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

function easeInOutQuad(t) {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function activateGroup(project) {
  console.log(`Activating group for project: ${project}`);

  // Store original values before transitioning
  storedScale = targetScale;
  storedOriginX = targetOriginX;
  storedOriginY = targetOriginY;

  activeProject = project;
  
  topZ = 4000; // reset stacking for new group

  // Set target values for the transition (zoom-out to start)
  targetScale = 0.6;  // Start by zooming out
  targetOriginX = CAMERA_CENTER_X;  // Center the camera
  targetOriginY = CAMERA_CENTER_Y;

  console.log(`Transitioning to group mode - targetOriginX: ${targetOriginX}, targetOriginY: ${targetOriginY}, targetScale: ${targetScale}`);

  cameraPaused = true;  // Pause the camera loop during transition

  // Step 1: Cinematic Zoom‑Out
  const zoomOutDuration = 1000;
  let startTime = null;
  
    // Adjust opacity of all images based on whether they are part of the active group
  images.forEach(img => {
    if (img.dataset.project === project) {
      img.style.opacity = "1";  // Full opacity for active group images
      img._floating = true;    // Mark images in the active group as floating
    } else {
      img.style.opacity = "0.15";  // Reduced opacity for images outside the active group
      img._floating = false;      // Mark images outside the active group as not floating
    }
  });

  function zoomOutAnim(now) {
    if (!startTime) startTime = now;
    let t = (now - startTime) / zoomOutDuration;
    if (t > 1) t = 1;

    const eased = easeInOutQuad(t);

    // Smooth zoom-out (from stored values)
    targetScale = storedScale + (0.6 - storedScale) * eased;
    targetOriginX = storedOriginX + (CAMERA_CENTER_X - storedOriginX) * eased;
    targetOriginY = storedOriginY + (CAMERA_CENTER_Y - storedOriginY) * eased;

    console.log(`Zoom out - targetScale: ${targetScale}, targetOriginX: ${targetOriginX}, targetOriginY: ${targetOriginY}`);

    applyTransform();  // Apply the smooth transition

    if (t < 1) {
      requestAnimationFrame(zoomOutAnim);  // Continue zoom-out
    } else {
      placeImagesInSpiral(project);  // Once zoom-out is complete, arrange images and start zoom-in
    }
  }

  requestAnimationFrame(zoomOutAnim);
}

function placeImagesInSpiral(project) {
  const groupImages = images.filter(i => i.dataset.project === project);
  const COUNT = groupImages.length;
  const IMAGE_SIZE = 320;
  const MIN_GAP = 40;

  /* WORLD SPACE — NOT CAMERA SPACE */
  const CENTER_X = -window.innerWidth * 0.25;  // Center-left position for the images
  const CENTER_Y = 0;

  const MAX_RADIUS = Math.min(
    window.innerWidth * 0.28,
    window.innerHeight * 0.45
  );

  const density = Math.min(Math.max(COUNT / 14, 0.8), 2.2);
  const SPACING = (IMAGE_SIZE + MIN_GAP) / density;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  groupImages.forEach((img, i) => {
    img.style.width = IMAGE_SIZE + "px";  // Ensure all images have consistent size

    const angle = i * GOLDEN_ANGLE;
    const t = i / COUNT;

    // Spiral radius calculation based on index
    const spiralRadius = Math.sqrt(i) * SPACING;
    const linearRadius = t * MAX_RADIUS;

    const radius = Math.min(
      spiralRadius * 0.4 + linearRadius * 0.6,  // Blend spiral and linear radius
      MAX_RADIUS
    );

    // Calculate the x and y coordinates for each image in the spiral
    const x = CENTER_X + Math.cos(angle) * radius;
    const y = CENTER_Y + Math.sin(angle) * radius;

    // Set the image's position in the world space
    img._x = x;
    img._y = y;
    img._tx = x;
    img._ty = y;

    img.style.zIndex = 1000 + i;  // Ensure images are stacked correctly
    img.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });

  // Step 2: Cinematic Zoom‑In (smooth transition)
  const zoomInDuration = 500;  // Duration for zoom-in transition
  let zoomInStartTime = null;

  function zoomInAnim(now) {
    if (!zoomInStartTime) zoomInStartTime = now;
    let t = (now - zoomInStartTime) / zoomInDuration;
    if (t > 1) t = 1;

    const eased = easeInOutQuad(t);

    // Smooth zoom-in (from 0.6 to 1)
    targetScale = 0.6 + (1 - 0.6) * eased;
    targetScale = Math.min(targetScale, 1);  // Ensure we don't overshoot the scale
    
    // Lock the camera's center during the zoom-in transition (no change to targetOriginX, targetOriginY)
    targetOriginX = CAMERA_CENTER_X;
    targetOriginY = CAMERA_CENTER_Y;

    // Apply the transformation
    applyTransform();

    // If zoom-in is complete, finalize the zoom
    if (t === 1) {
      targetScale = 1;
      targetOriginX = CAMERA_CENTER_X;
      targetOriginY = CAMERA_CENTER_Y;
      applyTransform();  // Apply the final transform

      descriptions.classList.add("visible");

      Array.from(descriptions.children).forEach(desc => {
        desc.style.display = desc.dataset.project === project ? "block" : "none";
      });

      cameraPaused = false;  // Unpause the camera loop
    } else {
      requestAnimationFrame(zoomInAnim);  // Continue zoom-in transition
    }
  }

  requestAnimationFrame(zoomInAnim);
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

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // If a project group is active, exit the group
    if (activeProject) {
      activeProject = null;
      descriptions.classList.remove("visible");

      // Reset images and their properties
      images.forEach(img => {
        img._floating = true;
        img.style.opacity = "1";
        img.style.zIndex = 1;
        img.style.width = "100px";
      });

      // Reset images to their original positions
      originals.forEach(o => {
        o.img._x = o.x;
        o.img._y = o.y;
        o.img._tx = o.x;
        o.img._ty = o.y;
        o.img.style.transform = `translate(${o.x}px, ${o.y}px) translate(-50%, -50%)`;
      });

      // Restore the camera state
      targetScale = storedScale;
      targetOriginX = storedOriginX;
      targetOriginY = storedOriginY;

      cameraPaused = false;

      // Apply camera transform and start the camera loop again
      applyTransform();
      cameraLoop();
    } else {
      // Close Projects Panel if open
      if (projectsPanel.classList.contains("visible")) {
        projectsPanel.style.display = "none";
        projectsPanel.classList.remove("visible");
      }

      // Close About Panel if open
      if (aboutPanel.classList.contains("visible")) {
        aboutPanel.classList.remove("visible");
        aboutPanel.hidden = true; // Optionally hide the panel completely
      }
    }
  }
});


/* =====================================================
   ABOUT PANEL
===================================================== */

const aboutBtn = document.getElementById("about-btn");
const aboutPanel = document.getElementById("about-panel");

aboutBtn.addEventListener("click", () => {
  // If the Projects Panel is open, close it first
  if (projectsPanel.classList.contains("visible")) {
    projectsPanel.style.display = "none";
    projectsPanel.classList.remove("visible");
  }

  // Toggle the About Panel (open/close)
  if (aboutPanel.classList.contains("visible")) {
    aboutPanel.classList.remove("visible");
    aboutPanel.hidden = true;
  } else {
    aboutPanel.classList.add("visible");
    aboutPanel.hidden = false;
  }
});


/* =====================================================
   PROJECT DIRECTORY
===================================================== */

const projectsBtn = document.getElementById("projects-btn");
const projectsPanel = document.getElementById("projects-panel");

// Make sure the panel is initially hidden
projectsPanel.style.display = "none"; // Ensure it is hidden on load

projectsBtn.addEventListener("click", () => {
  // If the About Panel is open, close it first
  if (aboutPanel.classList.contains("visible")) {
    aboutPanel.classList.remove("visible");
    aboutPanel.hidden = true;
  }

  // Toggle the Projects Panel (open/close)
  if (projectsPanel.classList.contains("visible")) {
    projectsPanel.style.display = "none";
    projectsPanel.classList.remove("visible");
  } else {
    projectsPanel.style.display = "block";
    projectsPanel.classList.add("visible");
  }
});


/* =====================================================
   PROJECT BUTTONS
===================================================== */

const projectButtons = document.querySelectorAll('.project-btn');

projectButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    const projectId = e.target.dataset.project;  // Get the project ID from the button's data-project attribute
    
    // If on mobile, trigger the mobile group view
    if (window.innerWidth <= 768) {
      // Hide the projects panel and show the mobile group view
      projectsPanel.style.display = "none";
      projectsPanel.classList.remove("visible");

      openMobileGroup(projectId); // Trigger the mobile group view
    } else {
      // For larger screens, handle normal group transition (as usual)
      projectsPanel.style.display = "none";
      projectsPanel.classList.remove("visible");

      // Trigger the transition for the group (using existing transition logic)
      activateGroup(projectId);  // Call the existing function to trigger the zoom and group transition
    }
  });
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

//Project Description position reload
window.addEventListener("load", () => {
  const projectDescription = document.getElementById("project-descriptions");
  projectDescription.style.top = "50%";
  projectDescription.style.transform = "translateY(-50%)"; // Reapply center positioning
});
