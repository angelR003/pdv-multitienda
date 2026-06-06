const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const API_URL = "http://localhost:3000/api";
const tiendaId = Number(localStorage.getItem("tienda_id"));
const tiendaNombre =
  localStorage.getItem("tienda_nombre") || "Terminal sin configurar";

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

const STORAGE_ALERTAS_INVENTARIO_VISTAS = "alertasInventarioVistas";
let notificacionesActuales = [];

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
  usuarioRol.textContent = `${usuario.rol} - ${tiendaNombre}`;
}

btnLogout?.addEventListener("click", cerrarSesion);

btnNotificaciones?.addEventListener("click", () => {
  const vaAbrir = panelNotificaciones.classList.contains("hidden");

  panelNotificaciones.classList.toggle("hidden");

  if (vaAbrir) {
    marcarAlertasInventarioVistas();
    actualizarEstadoCampana(notificacionesActuales);
  }
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

  if (
    !updateBox ||
    !updateVersion ||
    !updateProgress ||
    !btnDescargarUpdate ||
    !btnInstalarUpdate
  ) {
    return;
  }

  window.actualizador.cuandoHayUpdate((data) => {
    updateBox.classList.remove("hidden");
    updateVersion.textContent = `Version nueva disponible: ${data.version}`;
    updateProgress.textContent =
      "Puedes descargarla cuando no haya clientes esperando.";
  });

  window.actualizador.progreso((data) => {
    updateProgress.textContent = `Descargando actualizacion: ${data.percent}%`;
  });

  window.actualizador.cuandoDescargada(() => {
    updateProgress.textContent =
      "Actualizacion descargada. Instalala cuando puedas reiniciar el sistema.";
    btnInstalarUpdate.classList.remove("hidden");
    btnDescargarUpdate.classList.add("hidden");
  });

  window.actualizador.cuandoError((data) => {
    updateBox.classList.remove("hidden");
    updateProgress.textContent = `Error al actualizar: ${data.mensaje}`;
    btnDescargarUpdate.disabled = false;
  });

  btnRevisarUpdate?.addEventListener("click", async () => {
    updateBox.classList.remove("hidden");
    updateProgress.textContent = "Buscando actualizacion...";

    try {
      await window.actualizador.revisar();
    } catch (error) {
      updateProgress.textContent = "No se pudo revisar la actualizacion.";
    }
  });

  btnDescargarUpdate.addEventListener("click", async () => {
    btnDescargarUpdate.disabled = true;
    updateProgress.textContent = "Iniciando descarga...";

    const respuesta = await window.actualizador.descargar();

    if (!respuesta.ok) {
      updateProgress.textContent =
        respuesta.mensaje || "No se pudo descargar la actualizacion.";
      btnDescargarUpdate.disabled = false;
    }
  });

  btnInstalarUpdate.addEventListener("click", () => {
    const confirmar = confirm(
      "El sistema se cerrara para instalar la actualizacion. Hazlo solo si no estas cobrando una venta. Continuar?"
    );

    if (confirmar) {
      window.actualizador.instalar();
    }
  });

  setTimeout(() => {
    window.actualizador.revisar().catch((error) => {
      console.log("No se pudo revisar actualizacion:", error);
    });
  }, 3000);
}

document.addEventListener("DOMContentLoaded", inicializarActualizador);

async function cargarNotificaciones() {
  try {
    const peticiones = [
      fetch(`${API_URL}/traspasos/notificaciones`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ];

    if (tiendaId) {
      peticiones.push(
        fetch(`${API_URL}/inventario/alertas-minimas/${tiendaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );
    }

    const [responseTraspasos, responseInventario] = await Promise.all(peticiones);
    const traspasos = responseTraspasos.ok ? await responseTraspasos.json() : [];
    const inventario =
      responseInventario && responseInventario.ok
        ? await responseInventario.json()
        : [];

    const notificaciones = [
      ...traspasos.map((traspaso) => ({
        ...traspaso,
        tipo: "traspaso",
        key: `traspaso-${traspaso.id}`,
      })),
      ...inventario.map((producto) => {
        const key = crearKeyAlertaInventario(producto);

        return {
          ...producto,
          tipo: "inventario_minimo",
          key,
          vista: alertaInventarioVista(key),
        };
      }),
    ];

    renderNotificaciones(notificaciones);
  } catch (error) {
    renderNotificaciones([]);
  }
}

function obtenerAlertasInventarioVistas() {
  try {
    const alertas = JSON.parse(
      localStorage.getItem(STORAGE_ALERTAS_INVENTARIO_VISTAS) || "[]"
    );

    return Array.isArray(alertas) ? alertas : [];
  } catch (error) {
    return [];
  }
}

function guardarAlertasInventarioVistas(alertas) {
  localStorage.setItem(
    STORAGE_ALERTAS_INVENTARIO_VISTAS,
    JSON.stringify([...new Set(alertas)])
  );
}

function crearKeyAlertaInventario(producto) {
  return [
    "inventario",
    producto.tienda_id,
    producto.producto_id,
    Number(producto.cantidad_actual),
    Number(producto.cantidad_minima),
  ].join(":");
}

function alertaInventarioVista(key) {
  return obtenerAlertasInventarioVistas().includes(key);
}

function marcarAlertasInventarioVistas() {
  const vistas = obtenerAlertasInventarioVistas();
  const nuevas = notificacionesActuales
    .filter((notificacion) => notificacion.tipo === "inventario_minimo")
    .map((notificacion) => notificacion.key);

  if (nuevas.length === 0) {
    return;
  }

  guardarAlertasInventarioVistas([...vistas, ...nuevas]);

  notificacionesActuales = notificacionesActuales.map((notificacion) => {
    if (notificacion.tipo !== "inventario_minimo") {
      return notificacion;
    }

    return {
      ...notificacion,
      vista: true,
    };
  });
}

function actualizarEstadoCampana(notificaciones) {
  const totalNotificaciones = notificaciones.length;
  const hayTraspasos = notificaciones.some(
    (notificacion) => notificacion.tipo === "traspaso"
  );
  const hayInventarioNuevo = notificaciones.some(
    (notificacion) =>
      notificacion.tipo === "inventario_minimo" && !notificacion.vista
  );

  if (totalNotificaciones === 0) {
    contadorNotificaciones.classList.add("hidden");
    iconoCampana?.classList.remove("campana-activa");
    return;
  }

  contadorNotificaciones.textContent = totalNotificaciones;
  contadorNotificaciones.classList.remove("hidden");

  if (hayTraspasos || hayInventarioNuevo) {
    iconoCampana?.classList.add("campana-activa");
  } else {
    iconoCampana?.classList.remove("campana-activa");
  }
}

function formatearCantidadInventario(producto, valor) {
  const numero = Number(valor || 0);
  const unidad = producto.presentacion || producto.unidad || "pieza";

  if (Number.isInteger(numero)) {
    return `${numero} ${unidad}`;
  }

  return `${numero.toFixed(3).replace(/\.?0+$/, "")} ${unidad}`;
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNotificacionTraspaso(notificacion) {
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
          ${escapeHtml(notificacion.tienda_origen)} &rarr; ${escapeHtml(notificacion.tienda_destino)}
        </p>

        <p class="text-sm text-zinc-300 mt-2">
          ${escapeHtml(notificacion.resumen_productos || "Productos pendientes por recibir")}
        </p>
      </div>

      <span class="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-2 py-1 text-xs font-bold">
        enviado
      </span>
    </div>
  `;

  return a;
}

function renderNotificacionInventario(notificacion) {
  const a = document.createElement("a");

  a.href = "./inventario.html?filtro=bajo";
  a.className =
    "block p-4 border-b border-zinc-800 hover:bg-zinc-900 transition";

  const existencia = formatearCantidadInventario(
    notificacion,
    notificacion.cantidad_actual
  );
  const minimo = formatearCantidadInventario(
    notificacion,
    notificacion.cantidad_minima
  );

  a.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-black">
          ${escapeHtml(notificacion.producto)}
        </p>

        <p class="text-sm text-zinc-400 mt-1">
          Existencia: ${escapeHtml(existencia)} &middot; minimo: ${escapeHtml(minimo)}
        </p>

        <p class="text-sm text-zinc-300 mt-2">
          Revisa inventario o registra una entrada cuando llegue mercancia.
        </p>
      </div>

      <span class="bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-2 py-1 text-xs font-bold">
        minimo
      </span>
    </div>
  `;

  return a;
}

function renderNotificaciones(notificaciones) {
  notificacionesActuales = notificaciones;
  listaNotificaciones.innerHTML = "";
  actualizarEstadoCampana(notificaciones);

  if (notificaciones.length === 0) {
    listaNotificaciones.innerHTML = `
      <div class="p-5 text-zinc-500 text-sm">
        No hay notificaciones pendientes.
      </div>
    `;

    return;
  }

  notificaciones.forEach((notificacion) => {
    if (notificacion.tipo === "traspaso") {
      listaNotificaciones.appendChild(renderNotificacionTraspaso(notificacion));
      return;
    }

    if (notificacion.tipo === "inventario_minimo") {
      listaNotificaciones.appendChild(renderNotificacionInventario(notificacion));
    }
  });
}
