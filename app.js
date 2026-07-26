const DEFAULT_MESSAGE = "aqui esta el punto";

const TARGET_STORAGE_KEY = "ar-target-config";
const LEGACY_TARGET_STORAGE_KEY = "ar-target-coordinates";

const ALIGNMENT_THRESHOLD_DEG = 15;

const els = {
  camera: document.getElementById("camera"),
  status: document.getElementById("status"),
  distance: document.getElementById("distance"),
  angle: document.getElementById("angle"),
  targetMessage: document.getElementById("targetMessage"),
  reticle: document.getElementById("reticle"),
  startBtn: document.getElementById("startBtn"),
  latInput: document.getElementById("latInput"),
  lonInput: document.getElementById("lonInput"),
  saveCoordsBtn: document.getElementById("saveCoordsBtn"),
  resetCoordsBtn: document.getElementById("resetCoordsBtn"),
  targetInfo: document.getElementById("targetInfo"),
  messageInput: document.getElementById("messageInput"),
};

const state = {
  heading: null,
  position: null,
  watchId: null,
  target: {
    name: "Objetivo personalizado",
    latitude: null,
    longitude: null,
    message: DEFAULT_MESSAGE,
  },
};

function cleanMessage(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_MESSAGE;
}

function updateTargetMessageLabel() {
  els.targetMessage.textContent = state.target.message;
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

function syncTargetUi() {
  els.latInput.value = state.target.latitude === null ? "" : String(state.target.latitude);
  els.lonInput.value = state.target.longitude === null ? "" : String(state.target.longitude);
  els.messageInput.value = state.target.message;
  if (state.target.latitude === null || state.target.longitude === null) {
    els.targetInfo.textContent = "Sin objetivo guardado";
  } else {
    els.targetInfo.textContent = `Lat: ${state.target.latitude} | Lon: ${state.target.longitude}`;
  }
  updateTargetMessageLabel();
}

function parseCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function applyManualCoordinates() {
  const lat = parseCoordinate(els.latInput.value);
  const lon = parseCoordinate(els.lonInput.value);
  const message = cleanMessage(els.messageInput.value);

  if (lat === null || lon === null) {
    els.status.textContent = "Ingresa latitud y longitud validas.";
    return;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    els.status.textContent = "Rango invalido. Latitud: -90 a 90, Longitud: -180 a 180.";
    return;
  }

  state.target.latitude = lat;
  state.target.longitude = lon;
  state.target.message = message;
  state.target.name = "Objetivo personalizado";
  saveTargetToStorage();
  syncTargetUi();
  els.status.textContent = "Coordenadas guardadas. Ahora apunta hacia el nuevo objetivo.";
  updateArState();
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
  els.status.textContent = "Objetivo limpiado. Ingresa coordenadas para continuar.";
  updateArState();
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeDegrees(deg) {
  return (deg + 360) % 360;
}

function minimalAngleDiff(a, b) {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingToTarget(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const lambda = toRadians(lon2 - lon1);

  const y = Math.sin(lambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
    },
    audio: false,
  });

  els.camera.srcObject = stream;
}

function startLocationWatch() {
  if (!navigator.geolocation) {
    els.status.textContent = "Este navegador no soporta geolocalizacion.";
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.position = pos.coords;
      updateArState();
    },
    (err) => {
      els.status.textContent = `Error de ubicacion: ${err.message}`;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    }
  );
}

function onDeviceOrientation(event) {
  let heading = null;

  if (typeof event.webkitCompassHeading === "number") {
    heading = event.webkitCompassHeading;
  } else if (typeof event.alpha === "number") {
    heading = 360 - event.alpha;
  }

  if (heading === null) {
    return;
  }

  state.heading = normalizeDegrees(heading);
  updateArState();
}

function showTargetMessage(show) {
  els.targetMessage.classList.toggle("hidden", !show);
  els.reticle.classList.toggle("hidden", !show);
}

function updateArState() {
  const hasHeading = typeof state.heading === "number";
  const hasPosition = !!state.position;
  const hasTarget =
    typeof state.target.latitude === "number" && typeof state.target.longitude === "number";

  if (!hasTarget) {
    els.status.textContent = "Ingresa latitud y longitud, luego pulsa Guardar objetivo.";
    showTargetMessage(false);
    els.angle.textContent = "--";
    els.distance.textContent = "--";
    return;
  }

  if (!hasHeading || !hasPosition) {
    const waiting = [];
    if (!hasPosition) waiting.push("ubicacion");
    if (!hasHeading) waiting.push("brujula");
    els.status.textContent = `Esperando ${waiting.join(" y ")}...`;
    showTargetMessage(false);
    return;
  }

  const userLat = state.position.latitude;
  const userLon = state.position.longitude;

  const bearing = bearingToTarget(userLat, userLon, state.target.latitude, state.target.longitude);
  const distance = distanceMeters(userLat, userLon, state.target.latitude, state.target.longitude);
  const diff = minimalAngleDiff(state.heading, bearing);

  els.angle.textContent = `${Math.round(diff)}deg`;
  els.distance.textContent = `${Math.round(distance)} m`;

  const isAligned = diff <= ALIGNMENT_THRESHOLD_DEG;

  els.status.textContent = isAligned
    ? `Apuntando a ${state.target.name}`
    : `Gira hasta alinear el celular con ${state.target.name}`;

  showTargetMessage(isAligned);
}

async function requestMotionPermissionIfNeeded() {
  if (typeof DeviceOrientationEvent === "undefined") {
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res !== "granted") {
      throw new Error("Permiso de brujula denegado.");
    }
  }
}

async function startApp() {
  try {
    els.startBtn.disabled = true;
    els.startBtn.textContent = "Activando...";

    await requestMotionPermissionIfNeeded();
    window.addEventListener("deviceorientationabsolute", onDeviceOrientation, true);
    window.addEventListener("deviceorientation", onDeviceOrientation, true);

    await startCamera();
    startLocationWatch();

    els.status.textContent = "Sensores activos. Mueve el celular para calibrar la brujula.";
    els.startBtn.textContent = "Sensores activos";
  } catch (error) {
    els.status.textContent = `No fue posible iniciar: ${error.message}`;
    els.startBtn.disabled = false;
    els.startBtn.textContent = "Reintentar";
  }
}

els.startBtn.addEventListener("click", startApp);
els.saveCoordsBtn.addEventListener("click", applyManualCoordinates);
els.resetCoordsBtn.addEventListener("click", clearTargetConfig);

loadStoredTarget();
syncTargetUi();
