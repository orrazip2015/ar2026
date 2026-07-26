const activateArBtn = document.getElementById("activateAr");
const arStatus = document.getElementById("arStatus");
const arScene = document.getElementById("arScene");
const overlay = document.getElementById("overlay");
const latInput = document.getElementById("latInput");
const lonInput = document.getElementById("lonInput");
const saveCoordsBtn = document.getElementById("saveCoordsBtn");
const resetCoordsBtn = document.getElementById("resetCoordsBtn");
const targetInfo = document.getElementById("targetInfo");
const targetLabel = document.getElementById("targetLabel");

const DEFAULT_TARGET = {
  name: "Mall Plaza La Serena",
  latitude: -29.9127825,
  longitude: -71.2582358,
};

const TARGET_STORAGE_KEY = "ar-target-coordinates";

const state = {
  target: { ...DEFAULT_TARGET },
};

function parseCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function loadStoredTarget() {
  const raw = localStorage.getItem(TARGET_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
      state.target.latitude = parsed.latitude;
      state.target.longitude = parsed.longitude;
      state.target.name = "Objetivo personalizado";
    }
  } catch {
    localStorage.removeItem(TARGET_STORAGE_KEY);
  }
}

function syncTargetUi() {
  latInput.value = String(state.target.latitude);
  lonInput.value = String(state.target.longitude);
  targetInfo.textContent = `Lat: ${state.target.latitude} | Lon: ${state.target.longitude}`;
}

function updateTargetEntity() {
  targetLabel.setAttribute(
    "gps-entity-place",
    `latitude: ${state.target.latitude}; longitude: ${state.target.longitude}`
  );
}

function saveTargetToStorage() {
  localStorage.setItem(
    TARGET_STORAGE_KEY,
    JSON.stringify({
      latitude: state.target.latitude,
      longitude: state.target.longitude,
    })
  );
}

function applyManualCoordinates() {
  const lat = parseCoordinate(latInput.value);
  const lon = parseCoordinate(lonInput.value);

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
  state.target.name = "Objetivo personalizado";

  saveTargetToStorage();
  syncTargetUi();
  updateTargetEntity();
  arStatus.textContent = "Coordenadas guardadas en AR 3D.";
}

function resetToDefaultTarget() {
  state.target = { ...DEFAULT_TARGET };
  localStorage.removeItem(TARGET_STORAGE_KEY);
  syncTargetUi();
  updateTargetEntity();
  arStatus.textContent = "Coordenadas restauradas a Mall Plaza La Serena.";
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
    activateArBtn.disabled = true;
    activateArBtn.textContent = "Activando...";

    ensureGeolocationAvailable();
    await requestOrientationPermissionIfNeeded();

    arScene.classList.remove("hidden");
    arStatus.textContent = `AR activo. Apunta hacia ${state.target.name}.`;

    // Dejamos el panel visible unos segundos para confirmar que activo.
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 2500);
  } catch (error) {
    arStatus.textContent = `No fue posible iniciar: ${error.message}`;
    activateArBtn.disabled = false;
    activateArBtn.textContent = "Reintentar";
  }
}

window.addEventListener("gps-camera-update-position", () => {
  // Evento util para confirmar que AR.js ya recibe ubicacion.
  if (!overlay.classList.contains("hidden")) {
    arStatus.textContent = "Ubicacion detectada. Busca el rotulo del mall en camara.";
  }
});

activateArBtn.addEventListener("click", startArExperience);
saveCoordsBtn.addEventListener("click", applyManualCoordinates);
resetCoordsBtn.addEventListener("click", resetToDefaultTarget);

loadStoredTarget();
syncTargetUi();
updateTargetEntity();
