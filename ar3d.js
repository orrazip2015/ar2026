const activateArBtn = document.getElementById("activateAr");
const arStatus = document.getElementById("arStatus");
const arScene = document.getElementById("arScene");
const overlay = document.getElementById("overlay");
const latInput = document.getElementById("latInput");
const lonInput = document.getElementById("lonInput");
const messageInput = document.getElementById("messageInput");
const saveCoordsBtn = document.getElementById("saveCoordsBtn");
const resetCoordsBtn = document.getElementById("resetCoordsBtn");
const targetInfo = document.getElementById("targetInfo");
const targetLabel = document.getElementById("targetLabel");
const hudPanel = document.getElementById("hudPanel");
const menuCollapseBtn = document.getElementById("menuCollapseBtn");
const menuOpenBtn = document.getElementById("menuOpenBtn");

const DEFAULT_MESSAGE = "aqui esta el punto";

const TARGET_STORAGE_KEY = "ar-target-config";
const LEGACY_TARGET_STORAGE_KEY = "ar-target-coordinates";
const HEADING_SMOOTH_SAMPLES = 12;

let pokeballRotation = 0;
let animationId = null;

const state = {
  menuCollapsed: false,
  headingHistory: [],
  target: {
    name: "Objetivo personalizado",
    latitude: null,
    longitude: null,
    message: DEFAULT_MESSAGE,
  },
};

function startPokeballAnimation() {
  if (animationId) cancelAnimationFrame(animationId);
  
  function animate() {
    pokeballRotation += 2;
    
    const top = document.getElementById("pokeball-top");
    const bottom = document.getElementById("pokeball-bottom");
    const center = document.getElementById("pokeball-center");
    
    if (top) top.setAttribute("rotation", `0 ${pokeballRotation} 0`);
    if (bottom) bottom.setAttribute("rotation", `0 ${pokeballRotation} 0`);
    if (center) center.setAttribute("rotation", `0 ${-pokeballRotation} 0`);
    
    animationId = requestAnimationFrame(animate);
  }
  
  animate();
}

function stopPokeballAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function setMenuCollapsed(collapsed) {
  state.menuCollapsed = collapsed;
  hudPanel.classList.toggle("hidden", collapsed);
  menuOpenBtn.classList.toggle("hidden", !collapsed);
  
  // Si abres el menú, restaura la visibilidad del overlay
  if (!collapsed) {
    overlay.style.pointerEvents = "auto";
    overlay.style.opacity = "1";
  }
}

function parseCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanMessage(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_MESSAGE;
}

function loadStoredTarget() {
  const raw = localStorage.getItem(TARGET_STORAGE_KEY);
  const legacyRaw = !raw ? localStorage.getItem(LEGACY_TARGET_STORAGE_KEY) : null;

  if (!raw && !legacyRaw) {
    return;
  }

  const source = raw || legacyRaw;
  if (!raw) {
    localStorage.removeItem(LEGACY_TARGET_STORAGE_KEY);
  }

  try {
    const parsed = JSON.parse(source);
    if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
      state.target.latitude = parsed.latitude;
      state.target.longitude = parsed.longitude;
      state.target.message = cleanMessage(parsed.message);
      state.target.name = "Objetivo personalizado";
    }
  } catch {
    localStorage.removeItem(TARGET_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TARGET_STORAGE_KEY);
  }
}

function syncTargetUi() {
  latInput.value = state.target.latitude === null ? "" : String(state.target.latitude);
  lonInput.value = state.target.longitude === null ? "" : String(state.target.longitude);
  messageInput.value = state.target.message;
  if (state.target.latitude === null || state.target.longitude === null) {
    targetInfo.textContent = "Sin objetivo guardado";
  } else {
    targetInfo.textContent = `Lat: ${state.target.latitude} | Lon: ${state.target.longitude}`;
  }
}

function updateTargetEntity() {
  const hasTarget =
    typeof state.target.latitude === "number" && typeof state.target.longitude === "number";

  if (!hasTarget) {
    targetLabel.setAttribute("visible", "false");
    return;
  }

  targetLabel.setAttribute(
    "gps-entity-place",
    `latitude: ${state.target.latitude}; longitude: ${state.target.longitude}`
  );
  targetLabel.setAttribute("visible", "true");

  // Actualizar el texto debajo del Pokéball
  const textElement = targetLabel.querySelector("a-text");
  if (textElement) {
    textElement.setAttribute("value", state.target.message);
  }
}

function saveTargetToStorage() {
  localStorage.setItem(
    TARGET_STORAGE_KEY,
    JSON.stringify({
      latitude: state.target.latitude,
      longitude: state.target.longitude,
      message: state.target.message,
    })
  );
}

function applyManualCoordinates() {
  const lat = parseCoordinate(latInput.value);
  const lon = parseCoordinate(lonInput.value);
  const message = cleanMessage(messageInput.value);

  if (lat === null || lon === null) {
    arStatus.textContent = "Ingresa latitud y longitud validas.";
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    arStatus.textContent = "Rango invalido. Latitud: -90 a 90, Longitud: -180 a 180.";
    return;
  }

  state.target.latitude = lat;
  state.target.longitude = lon;
  state.target.message = message;
  state.target.name = "Objetivo personalizado";

  saveTargetToStorage();
  syncTargetUi();
  updateTargetEntity();
  arStatus.textContent = "Coordenadas guardadas en AR 3D.";
}

function clearTargetConfig() {
  state.target = {
    name: "Objetivo personalizado",
    latitude: null,
    longitude: null,
    message: DEFAULT_MESSAGE,
  };
  localStorage.removeItem(TARGET_STORAGE_KEY);
  localStorage.removeItem(LEGACY_TARGET_STORAGE_KEY);
  syncTargetUi();
  updateTargetEntity();
  arStatus.textContent = "Objetivo limpiado. Ingresa coordenadas para continuar.";
}

async function requestOrientationPermissionIfNeeded() {
  if (typeof DeviceOrientationEvent === "undefined") {
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res !== "granted") {
      throw new Error("Permiso de brujula denegado");
    }
  }
}

function ensureGeolocationAvailable() {
  if (!navigator.geolocation) {
    throw new Error("Geolocalizacion no disponible en este navegador");
  }
}

async function startArExperience() {
  try {
    const hasTarget =
      typeof state.target.latitude === "number" && typeof state.target.longitude === "number";
    if (!hasTarget) {
      arStatus.textContent = "Primero ingresa coordenadas y pulsa Guardar objetivo.";
      return;
    }

    activateArBtn.disabled = true;
    activateArBtn.textContent = "Activando...";

    ensureGeolocationAvailable();
    await requestOrientationPermissionIfNeeded();

    // Ocultar overlay completamente
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "0";

    // Pequeño delay para que AR.js se inicialice
    await new Promise(resolve => setTimeout(resolve, 500));

    arScene.classList.remove("hidden");
    
    // Esperar a que la cámara se active
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    arStatus.textContent = `AR activo. Apunta hacia ${state.target.name}.`;
    setMenuCollapsed(true);
    startPokeballAnimation();
  } catch (error) {
    arStatus.textContent = `No fue posible iniciar: ${error.message}`;
    activateArBtn.disabled = false;
    activateArBtn.textContent = "Reintentar";
    stopPokeballAnimation();
    
    // Restaurar overlay
    overlay.style.pointerEvents = "auto";
    overlay.style.opacity = "1";
    arScene.classList.add("hidden");
  }
}

window.addEventListener("gps-camera-update-position", () => {
  // Evento util para confirmar que AR.js ya recibe ubicacion.
  if (!state.menuCollapsed) {
    arStatus.textContent = "Ubicacion detectada. Busca tu rotulo en camara.";
  }
});

// Monitorear carga de A-Frame
arScene.addEventListener("loaded", () => {
  console.log("A-Frame escena cargada");
});

arScene.addEventListener("renderstart", () => {
  console.log("Renderizado iniciado");
});

activateArBtn.addEventListener("click", startArExperience);
saveCoordsBtn.addEventListener("click", applyManualCoordinates);
resetCoordsBtn.addEventListener("click", clearTargetConfig);
menuCollapseBtn.addEventListener("click", () => setMenuCollapsed(true));
menuOpenBtn.addEventListener("click", () => setMenuCollapsed(false));

loadStoredTarget();
syncTargetUi();
updateTargetEntity();
setMenuCollapsed(false);
