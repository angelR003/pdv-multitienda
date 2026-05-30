const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaNombre = localStorage.getItem("tienda_nombre") || "Terminal sin configurar";

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const esAdmin = usuario.rol === "administrador";

const usuarioNombre = document.getElementById("usuarioNombre");
const usuarioRol = document.getElementById("usuarioRol");
const btnLogout = document.getElementById("btnLogout");

if (!esAdmin) {
  document.getElementById("cardUsuarios")?.remove();
  document.getElementById("cardPromociones")?.remove();
}

usuarioNombre.textContent = usuario.nombre;
usuarioRol.textContent = `${usuario.rol} • ${tiendaNombre}`;

btnLogout.addEventListener("click", cerrarSesion);

function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");

  window.location.href = "./login.html";
}

function inicializarActualizador() {
  if (!window.actualizador) {
    return;
  }

  const updateBox = document.getElementById("updateBox");
  const updateVersion = document.getElementById("updateVersion");
  const updateProgress = document.getElementById("updateProgress");
  const btnDescargarUpdate = document.getElementById("btnDescargarUpdate");
  const btnInstalarUpdate = document.getElementById("btnInstalarUpdate");
  const btnRevisarUpdate = document.getElementById("btnRevisarUpdate");

  if (!updateBox || !updateVersion || !updateProgress || !btnDescargarUpdate || !btnInstalarUpdate) {
    return;
  }

  window.actualizador.cuandoHayUpdate((data) => {
    updateBox.classList.remove("hidden");
    updateVersion.textContent = `Versión nueva disponible: ${data.version}`;
    updateProgress.textContent = "Puedes descargarla cuando no haya clientes esperando.";
  });

  window.actualizador.progreso((data) => {
    updateProgress.textContent = `Descargando actualización: ${data.percent}%`;
  });

  window.actualizador.cuandoDescargada(() => {
    updateProgress.textContent = "Actualización descargada. Instálala cuando puedas reiniciar el sistema.";
    btnInstalarUpdate.classList.remove("hidden");
    btnDescargarUpdate.classList.add("hidden");
  });

  window.actualizador.cuandoError((data) => {
    updateBox.classList.remove("hidden");
    updateProgress.textContent = `Error al actualizar: ${data.mensaje}`;
    btnDescargarUpdate.disabled = false;
  });

  btnDescargarUpdate.addEventListener("click", async () => {
    btnDescargarUpdate.disabled = true;
    updateProgress.textContent = "Iniciando descarga...";

btnRevisarUpdate?.addEventListener("click", async () => {
  alert("Click detectado en botón revisar actualización");

  updateBox.classList.remove("hidden");

  if (!window.actualizador) {
    updateProgress.textContent =
      "window.actualizador NO existe. El preload.js no está cargando.";
    return;
  }

  updateProgress.textContent = "window.actualizador existe. Buscando actualización...";

  const respuesta = await window.actualizador.revisar();

});

setTimeout(() => {
  window.actualizador.revisar().catch((error) => {
    console.log("No se pudo revisar actualización:", error);
  });
}, 3000);
    const respuesta = await window.actualizador.descargar();

    if (!respuesta.ok) {
      updateProgress.textContent = respuesta.mensaje || "No se pudo descargar la actualización.";
      btnDescargarUpdate.disabled = false;
    }
  });

  btnInstalarUpdate.addEventListener("click", () => {
    const confirmar = confirm(
      "El sistema se cerrará para instalar la actualización. Hazlo solo si no estás cobrando una venta. ¿Continuar?"
    );

    if (confirmar) {
      window.actualizador.instalar();
    }
  });
  setTimeout(() => {
  if (window.actualizador) {
    window.actualizador.revisar();
  }
}, 3000);
}

document.addEventListener("DOMContentLoaded", inicializarActualizador);

