const TARGET = {
  name: "Mall Plaza La Serena",
  // Coordenadas de referencia de Google Maps del mall.
  latitude: -29.9127825,
  longitude: -71.2582358,
};

const ALIGNMENT_THRESHOLD_DEG = 15;

const els = {
  camera: document.getElementById("camera"),
  status: document.getElementById("status"),
  distance: document.getElementById("distance"),
  angle: document.getElementById("angle"),
  targetMessage: document.getElementById("targetMessage"),
  reticle: document.getElementById("reticle"),
  startBtn: document.getElementById("startBtn"),
};

const state = {
  heading: null,
  position: null,
  watchId: null,
};

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

  const bearing = bearingToTarget(userLat, userLon, TARGET.latitude, TARGET.longitude);
  const distance = distanceMeters(userLat, userLon, TARGET.latitude, TARGET.longitude);
  const diff = minimalAngleDiff(state.heading, bearing);

  els.angle.textContent = `${Math.round(diff)}deg`;
  els.distance.textContent = `${Math.round(distance)} m`;

  const isAligned = diff <= ALIGNMENT_THRESHOLD_DEG;

  els.status.textContent = isAligned
    ? `Apuntando a ${TARGET.name}`
    : `Gira hasta alinear el celular con ${TARGET.name}`;

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
