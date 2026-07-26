const activateArBtn = document.getElementById("activateAr");
const arStatus = document.getElementById("arStatus");
const overlay = document.getElementById("overlay");
const hudPanel = document.getElementById("hudPanel");
const latInput = document.getElementById("latInput");
const lonInput = document.getElementById("lonInput");
const messageInput = document.getElementById("messageInput");
const saveCoordsBtn = document.getElementById("saveCoordsBtn");
const resetCoordsBtn = document.getElementById("resetCoordsBtn");
const targetInfo = document.getElementById("targetInfo");
const menuCollapseBtn = document.getElementById("menuCollapseBtn");
const menuOpenBtn = document.getElementById("menuOpenBtn");
const camera3d = document.getElementById("camera3d");
const threeCanvas = document.getElementById("threeCanvas");
const targetMessage3d = document.getElementById("targetMessage3d");
const debugPanel3d = document.getElementById("debugPanel3d");

const DEFAULT_MESSAGE = "aqui esta el punto";
const TARGET_STORAGE_KEY = "ar-target-config";
const LEGACY_TARGET_STORAGE_KEY = "ar-target-coordinates";
const POKEMON_GLB_URL = "";

const ALIGNMENT_THRESHOLD_DEG = 12;
const HEADING_SMOOTH_SAMPLES = 12;

const state = {
  menuCollapsed: false,
  arActive: false,
  orientationAllowed: false,
  orientationListening: false,
  heading: null,
  headingHistory: [],
  position: null,
  geolocationWatchId: null,
  cameraStream: null,
  rafId: null,
  target: {
    name: "Objetivo personalizado",
    latitude: null,
    longitude: null,
    message: DEFAULT_MESSAGE,
  },
};

let scene = null;
let threeCamera = null;
let renderer = null;
let pokemonGroup = null;
let threeReady = false;
const debugLines = [];

function debugLog(message) {
  const stamp = new Date().toLocaleTimeString();
  const line = `[${stamp}] ${message}`;
  debugLines.push(line);
  if (debugLines.length > 7) {
    debugLines.shift();
  }
  if (debugPanel3d) {
    debugPanel3d.textContent = debugLines.join("\n");
  }
  console.log("[AR3D]", message);
}

function setMenuCollapsed(collapsed) {
  state.menuCollapsed = collapsed;
  hudPanel.classList.toggle("hidden", collapsed);
  menuOpenBtn.classList.toggle("hidden", !collapsed);
  overlay.classList.toggle("align-items-end", !collapsed);
  overlay.classList.toggle("align-items-start", collapsed);
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
  updateArState();
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
  updateArState();
  arStatus.textContent = "Objetivo limpiado. Ingresa coordenadas para continuar.";
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

async function requestOrientationPermissionIfNeeded() {
  if (typeof DeviceOrientationEvent === "undefined") {
    debugLog("Brujula: no disponible en este navegador");
    return false;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      debugLog(`Brujula permiso: ${res}`);
      return res === "granted";
    } catch {
      debugLog("Brujula permiso: fallo al solicitar");
      return false;
    }
  }

  debugLog("Brujula: permiso implicito (sin prompt)");
  return true;
}

function ensureGeolocationAvailable() {
  if (!navigator.geolocation) {
    throw new Error("Geolocalizacion no disponible en este navegador");
  }
}

function extractHeading(event) {
  if (typeof event.webkitCompassHeading === "number") {
    return event.webkitCompassHeading;
  }
  if (typeof event.alpha === "number") {
    return (360 - event.alpha + 360) % 360;
  }
  return null;
}

function normalizeDeg(value) {
  return (value + 360) % 360;
}

function getSmoothedHeading(history) {
  if (!history.length) {
    return null;
  }

  let sumSin = 0;
  let sumCos = 0;
  for (const heading of history) {
    const rad = (heading * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }

  const avgRad = Math.atan2(sumSin / history.length, sumCos / history.length);
  return normalizeDeg((avgRad * 180) / Math.PI);
}

function onDeviceOrientation(event) {
  const heading = extractHeading(event);
  if (heading === null) {
    return;
  }

  state.headingHistory.push(normalizeDeg(heading));
  if (state.headingHistory.length > HEADING_SMOOTH_SAMPLES) {
    state.headingHistory.shift();
  }

  state.heading = getSmoothedHeading(state.headingHistory);
  updateArState();
}

function bearingToTarget(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaLon = (lon2 - lon1) * toRad;

  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);

  return normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function minimalAngleDiff(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function createFallbackPokemonMarker() {
  const group = new THREE.Group();

  const yellow = new THREE.MeshStandardMaterial({ color: 0xf7d117, roughness: 0.55, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.45, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5, metalness: 0.05 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), yellow);
  body.position.y = -0.1;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), yellow);
  head.position.y = 0.55;
  group.add(head);

  const earGeo = new THREE.ConeGeometry(0.12, 0.5, 14);
  const earL = new THREE.Mesh(earGeo, yellow);
  earL.position.set(-0.2, 1.0, -0.03);
  earL.rotation.z = 0.22;
  group.add(earL);

  const earR = new THREE.Mesh(earGeo, yellow);
  earR.position.set(0.2, 1.0, -0.03);
  earR.rotation.z = -0.22;
  group.add(earR);

  const earTipGeo = new THREE.ConeGeometry(0.07, 0.2, 10);
  const tipL = new THREE.Mesh(earTipGeo, black);
  tipL.position.set(-0.2, 1.2, -0.03);
  tipL.rotation.z = 0.22;
  group.add(tipL);

  const tipR = new THREE.Mesh(earTipGeo, black);
  tipR.position.set(0.2, 1.2, -0.03);
  tipR.rotation.z = -0.22;
  group.add(tipR);

  const cheekGeo = new THREE.SphereGeometry(0.08, 16, 12);
  const cheekL = new THREE.Mesh(cheekGeo, red);
  cheekL.position.set(-0.18, 0.5, 0.35);
  group.add(cheekL);

  const cheekR = new THREE.Mesh(cheekGeo, red);
  cheekR.position.set(0.18, 0.5, 0.35);
  group.add(cheekR);

  const eyeGeo = new THREE.SphereGeometry(0.045, 14, 10);
  const eyeL = new THREE.Mesh(eyeGeo, black);
  eyeL.position.set(-0.1, 0.65, 0.35);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, black);
  eyeR.position.set(0.1, 0.65, 0.35);
  group.add(eyeR);

  group.position.set(0, 0, -3.2);
  group.scale.setScalar(1.2);

  return group;
}

function loadGlbModel(url) {
  return new Promise((resolve, reject) => {
    if (!window.THREE || typeof THREE.GLTFLoader !== "function") {
      reject(new Error("GLTFLoader no disponible"));
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      gltf => resolve(gltf.scene),
      undefined,
      err => reject(err)
    );
  });
}

async function createPokemonMarker() {
  if (POKEMON_GLB_URL) {
    try {
      const model = await loadGlbModel(POKEMON_GLB_URL);
      model.position.set(0, -0.8, -3.2);
      model.scale.setScalar(1.3);
      return model;
    } catch (error) {
      console.warn("No se pudo cargar GLB, se usa fallback:", error);
    }
  }

  return createFallbackPokemonMarker();
}

async function initThreeScene() {
  debugLog("Three.js: creando escena");
  scene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(1.5, 2.2, 2.5);
  scene.add(key);

  pokemonGroup = await createPokemonMarker();
  pokemonGroup.visible = false;
  scene.add(pokemonGroup);

  threeReady = true;
  debugLog("Three.js: escena lista");
}

function renderLoop() {
  if (!state.arActive || !renderer || !scene || !threeCamera) {
    return;
  }

  if (pokemonGroup && pokemonGroup.visible) {
    pokemonGroup.rotation.y += 0.04;
    pokemonGroup.rotation.x = Math.sin(performance.now() * 0.002) * 0.08;
  }

  renderer.render(scene, threeCamera);
  state.rafId = requestAnimationFrame(renderLoop);
}

function startRenderLoop() {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
  }
  state.rafId = requestAnimationFrame(renderLoop);
}

function updateArState() {
  if (!threeReady || !pokemonGroup) {
    return;
  }

  const hasTarget =
    typeof state.target.latitude === "number" && typeof state.target.longitude === "number";

  if (!state.arActive || !hasTarget || !state.position) {
    pokemonGroup.visible = false;
    targetMessage3d.classList.add("hidden");
    return;
  }

  const bearing = bearingToTarget(
    state.position.latitude,
    state.position.longitude,
    state.target.latitude,
    state.target.longitude
  );
  const distance = distanceMeters(
    state.position.latitude,
    state.position.longitude,
    state.target.latitude,
    state.target.longitude
  );

  const hasHeading = state.heading !== null;
  const diff = hasHeading ? minimalAngleDiff(state.heading, bearing) : null;
  const aligned = hasHeading ? diff <= ALIGNMENT_THRESHOLD_DEG : distance <= 30;
  pokemonGroup.visible = aligned;

  if (aligned) {
    const clampedDistance = Math.max(2, Math.min(60, distance));
    const scale = Math.max(0.8, Math.min(1.8, 12 / Math.sqrt(clampedDistance)));
    pokemonGroup.scale.setScalar(scale);
    targetMessage3d.textContent = state.target.message;
    targetMessage3d.classList.remove("hidden");
    arStatus.textContent = `Objetivo detectado a ${distance.toFixed(1)} m.`;
  } else {
    targetMessage3d.classList.add("hidden");
    if (hasHeading) {
      arStatus.textContent = `Busca objetivo | Distancia ${distance.toFixed(1)} m | Error ${diff.toFixed(1)}°`;
    } else {
      arStatus.textContent = `Brujula no disponible | Distancia ${distance.toFixed(1)} m`;
    }
  }
}

async function startCamera() {
  if (state.cameraStream) {
    debugLog("Camara: stream existente reutilizado");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  state.cameraStream = stream;
  camera3d.srcObject = stream;
  await camera3d.play();
  debugLog("Camara: iniciada correctamente");
}

function startGeolocationWatch() {
  if (state.geolocationWatchId !== null) {
    debugLog("GPS: watch ya activo");
    return;
  }

  debugLog("GPS: iniciando watchPosition");
  state.geolocationWatchId = navigator.geolocation.watchPosition(
    pos => {
      state.position = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      debugLog(
        `GPS: ${state.position.latitude.toFixed(6)}, ${state.position.longitude.toFixed(6)} (±${Math.round(
          pos.coords.accuracy || 0
        )}m)`
      );
      updateArState();
    },
    error => {
      arStatus.textContent = `Error de ubicacion: ${error.message}`;
      debugLog(`GPS error: ${error.message}`);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    }
  );
}

async function startArExperience() {
  try {
    debugLog("Inicio AR3D: solicitado por usuario");
    const hasTarget =
      typeof state.target.latitude === "number" && typeof state.target.longitude === "number";

    if (!hasTarget) {
      arStatus.textContent = "Primero ingresa coordenadas y pulsa Guardar objetivo.";
      debugLog("Inicio AR3D: falta objetivo configurado");
      return;
    }

    activateArBtn.disabled = true;
    activateArBtn.textContent = "Activando...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camara no soportada en este navegador");
    }

    ensureGeolocationAvailable();
    debugLog("Chequeo: geolocalizacion disponible");

    state.orientationAllowed = await withTimeout(
      requestOrientationPermissionIfNeeded(),
      7000,
      "Tiempo de espera de brujula agotado"
    ).catch(() => false);
    debugLog(
      state.orientationAllowed
        ? "Brujula: habilitada"
        : "Brujula: no habilitada, se usa modo por distancia"
    );

    await withTimeout(startCamera(), 15000, "No se pudo iniciar la camara");
    startGeolocationWatch();

    if (!threeReady) {
      await withTimeout(initThreeScene(), 10000, "No se pudo crear la escena 3D");
    }

    if (!state.orientationListening) {
      window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
      state.orientationListening = true;
      debugLog("Brujula: listener deviceorientation activo");
    }

    state.arActive = true;
    camera3d.classList.remove("hidden");
    threeCanvas.classList.remove("hidden");
    setMenuCollapsed(true);
    startRenderLoop();
    updateArState();
    debugLog("Render: loop iniciado");

    activateArBtn.disabled = false;
    activateArBtn.textContent = "Reiniciar AR 3D";
    arStatus.textContent = state.orientationAllowed
      ? "AR 3D activo. Mueve el telefono para alinear el objetivo."
      : "AR 3D activo sin brujula. Acercate al objetivo para verlo.";
    debugLog("Estado: AR 3D activo");
  } catch (error) {
    state.arActive = false;
    activateArBtn.disabled = false;
    activateArBtn.textContent = "Reintentar";
    arStatus.textContent = `No fue posible iniciar: ${error.message}`;
    targetMessage3d.classList.add("hidden");
    debugLog(`Fallo inicio AR3D: ${error.message}`);
  }
}

function onResize() {
  if (!renderer || !threeCamera) {
    return;
  }
  threeCamera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

activateArBtn.addEventListener("click", startArExperience);
saveCoordsBtn.addEventListener("click", applyManualCoordinates);
resetCoordsBtn.addEventListener("click", clearTargetConfig);
menuCollapseBtn.addEventListener("click", () => setMenuCollapsed(true));
menuOpenBtn.addEventListener("click", () => setMenuCollapsed(false));
window.addEventListener("resize", onResize);

loadStoredTarget();
syncTargetUi();
setMenuCollapsed(false);
debugLog("Diagnostico listo");
