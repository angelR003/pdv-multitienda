const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!token || !usuario) {
  window.location.href = "./login.html";
}

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const params = new URLSearchParams(window.location.search);
const traspasoId = Number(params.get("id"));

if (!traspasoId) {
  window.location.href = "./traspasos.html";
}

const esAdmin = usuario.rol === "administrador";

const tituloTraspaso = document.getElementById("tituloTraspaso");
const subtituloTraspaso = document.getElementById("subtituloTraspaso");
const tiendaOrigen = document.getElementById("tiendaOrigen");
const tiendaDestino = document.getElementById("tiendaDestino");
const usuarioEnvio = document.getElementById("usuarioEnvio");
const estadoTraspaso = document.getElementById("estadoTraspaso");
const motivoTraspaso = document.getElementById("motivoTraspaso");
const tablaDetalles = document.getElementById("tablaDetalles");
const accionesTraspaso = document.getElementById("accionesTraspaso");
const btnRecibir = document.getElementById("btnRecibir");
const btnCancelar = document.getElementById("btnCancelar");
const mensaje = document.getElementById("mensaje");

let traspasoActual = null;

btnRecibir.addEventListener("click", recibirTraspaso);
btnCancelar.addEventListener("click", cancelarTraspaso);

cargarDetalle();

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

async function fetchJson(url, opciones = {}) {
  const response = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opciones.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error en la operación");
  }

  return data;
}

async function cargarDetalle() {
  try {
    const data = await fetchJson(`${API_URL}/traspasos/${traspasoId}`);

    traspasoActual = data.traspaso;

    renderDetalle(data.traspaso, data.detalles);
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

function renderDetalle(traspaso, detalles) {
  tituloTraspaso.textContent = `Traspaso #${traspaso.id}`;
  subtituloTraspaso.textContent = `Enviado: ${formatearFechaLocal(traspaso.fecha_envio)}`;

  tiendaOrigen.textContent = traspaso.tienda_origen;
  tiendaDestino.textContent = traspaso.tienda_destino;
  usuarioEnvio.textContent = traspaso.usuario;
  estadoTraspaso.textContent = traspaso.estado;
  estadoTraspaso.className = `text-xl font-bold mt-1 ${claseTextoEstado(traspaso.estado)}`;

  motivoTraspaso.textContent = traspaso.motivo
    ? `Motivo: ${traspaso.motivo}`
    : "Sin motivo registrado.";

  tablaDetalles.innerHTML = "";

  detalles.forEach((detalle) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-bold">${detalle.producto}</td>
      <td class="p-3 text-zinc-400">${detalle.tipo_producto}</td>
      <td class="p-3">${formatearCantidad(detalle.cantidad, detalle.unidad)} ${detalle.unidad}</td>
      <td class="p-3 text-zinc-500">${detalle.codigo_barras || "Sin código"}</td>
    `;

    tablaDetalles.appendChild(tr);
  });

  const puedeRecibir =
    traspaso.estado === "enviado" &&
    (esAdmin || Number(traspaso.tienda_destino_id) === Number(tiendaId));

  const puedeCancelar =
    traspaso.estado === "enviado" &&
    esAdmin;

  btnRecibir.classList.toggle("hidden", !puedeRecibir);
  btnCancelar.classList.toggle("hidden", !puedeCancelar);

  if (!puedeRecibir && !puedeCancelar) {
    accionesTraspaso.classList.add("hidden");
  } else {
    accionesTraspaso.classList.remove("hidden");
  }
}

async function recibirTraspaso() {
  const confirmar = confirm("¿Confirmas que la mercancía llegó completa?");

  if (!confirmar) return;

  try {
    const data = await fetchJson(`${API_URL}/traspasos/${traspasoId}/recibir`, {
      method: "PATCH",
    });

    mostrarMensaje(data.mensaje || "Traspaso recibido.");
    await cargarDetalle();
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

async function cancelarTraspaso() {
  const confirmar = confirm(
    "¿Seguro que quieres cancelar este traspaso? Se regresará el inventario a la tienda origen."
  );

  if (!confirmar) return;

  try {
    const data = await fetchJson(`${API_URL}/traspasos/${traspasoId}/cancelar`, {
      method: "PATCH",
    });

    mostrarMensaje(data.mensaje || "Traspaso cancelado.");
    await cargarDetalle();
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

function claseTextoEstado(estado) {
  if (estado === "enviado") return "text-yellow-300";
  if (estado === "recibido") return "text-green-300";
  if (estado === "cancelado") return "text-red-300";

  return "text-zinc-300";
}

function formatearCantidad(valor, unidad) {
  const numero = Number(valor || 0);

  if (unidad === "pieza") {
    return String(Math.round(numero));
  }

  return numero
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

function formatearFechaLocal(fecha) {
  if (!fecha) return "-";

  const fechaTexto = String(fecha);
  const fechaISO = normalizarFechaSQLite(fechaTexto);
  const date = new Date(fechaISO);

  if (isNaN(date.getTime())) return fechaTexto;

  return date.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizarFechaSQLite(fechaTexto) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)) {
    return fechaTexto;
  }

  return fechaTexto.replace(" ", "T") + "Z";
}
