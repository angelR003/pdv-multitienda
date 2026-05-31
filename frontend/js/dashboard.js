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
const btnNotificaciones = document.getElementById("btnNotificaciones");
const contadorNotificaciones = document.getElementById("contadorNotificaciones");
const panelNotificaciones = document.getElementById("panelNotificaciones");
const listaNotificaciones = document.getElementById("listaNotificaciones");
const iconoCampana = document.getElementById("iconoCampana");


if (!esAdmin) {
  document.getElementById("cardUsuarios")?.remove();
  document.getElementById("cardPromociones")?.remove();
    document.getElementById("cardTraspasos")?.remove();
      document.getElementById("cardReportes")?.remove();
}

if (usuarioNombre) {
  usuarioNombre.textContent = usuario.nombre;
}

if (usuarioRol) {
  usuarioRol.textContent = `${usuario.rol} • ${tiendaNombre}`;
}

btnLogout?.addEventListener("click", cerrarSesion);


btnNotificaciones?.addEventListener("click", () => {
  panelNotificaciones.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  if (
    panelNotificaciones &&
    btnNotificaciones &&
    !panelNotificaciones.contains(event.target) &&
    !btnNotificaciones.contains(event.target)
  ) {
    panelNotificaciones.classList.add("hidden");
  }
});

cargarNotificaciones();


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

async function cargarNotificaciones() {
  try {
    const response = await fetch("http://localhost:3000/api/traspasos/notificaciones", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      renderNotificaciones([]);
      return;
    }

    renderNotificaciones(data);
  } catch (error) {
    renderNotificaciones([]);
  }
}

function renderNotificaciones(notificaciones) {
  listaNotificaciones.innerHTML = "";

  if (notificaciones.length === 0) {
    contadorNotificaciones.classList.add("hidden");
          iconoCampana?.classList.remove("campana-activa");
    listaNotificaciones.innerHTML = `
      <div class="p-5 text-zinc-500 text-sm">
        No hay traspasos pendientes.
      </div>
    `;

    return;
  }

  contadorNotificaciones.textContent = notificaciones.length;
  contadorNotificaciones.classList.remove("hidden");
  iconoCampana?.classList.add("campana-activa");
  notificaciones.forEach((notificacion) => {
    const a = document.createElement("a");

    a.href = `./traspaso-detalle.html?id=${notificacion.id}`;
    a.className =
      "block p-4 border-b border-zinc-800 hover:bg-zinc-900 transition";

    a.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-black">
            Traspaso #${notificacion.id}
          </p>

          <p class="text-sm text-zinc-400 mt-1">
            ${notificacion.tienda_origen} → ${notificacion.tienda_destino}
          </p>

          <p class="text-sm text-zinc-300 mt-2">
            ${notificacion.resumen_productos || "Productos pendientes por recibir"}
          </p>
        </div>

        <span class="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-2 py-1 text-xs font-bold">
          enviado
        </span>
      </div>
    `;

    listaNotificaciones.appendChild(a);
  });
}