const activateArBtn = document.getElementById("activateAr");
const arStatus = document.getElementById("arStatus");
const arScene = document.getElementById("arScene");
const overlay = document.getElementById("overlay");

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
    arStatus.textContent = "AR activo. Apunta hacia Mall Plaza La Serena.";

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
