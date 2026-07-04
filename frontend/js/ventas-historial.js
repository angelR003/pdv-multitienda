const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const tablaVentas = document.getElementById("tablaVentas");
const busqueda = document.getElementById("busqueda");
const btnHoy = document.getElementById("btnHoy");
const btnAyer = document.getElementById("btnAyer");
const btnRango = document.getElementById("btnRango");
const filtrosRango = document.getElementById("filtrosRango");
const fechaInicio = document.getElementById("fechaInicio");
const fechaFin = document.getElementById("fechaFin");
const btnAplicarRango = document.getElementById("btnAplicarRango");
const btnAnterior = document.getElementById("btnAnterior");
const btnSiguiente = document.getElementById("btnSiguiente");
const paginaActual = document.getElementById("paginaActual");
const resumenPaginacion = document.getElementById("resumenPaginacion");

const LIMITE = 60;

let pagina = 1;
let totalPaginas = 1;
let periodo = "hoy";
let timeoutBusqueda = null;
let cargando = false;

busqueda.addEventListener("input", () => {
  clearTimeout(timeoutBusqueda);
  timeoutBusqueda = setTimeout(() => {
    pagina = 1;
    cargarVentas();
  }, 250);
});

btnHoy.addEventListener("click", () => seleccionarPeriodo("hoy"));
btnAyer.addEventListener("click", () => seleccionarPeriodo("ayer"));
btnRango.addEventListener("click", () => seleccionarPeriodo("rango"));
btnAplicarRango.addEventListener("click", () => {
  pagina = 1;
  cargarVentas();
});

btnAnterior.addEventListener("click", () => {
  if (pagina <= 1 || cargando) return;
  pagina -= 1;
  cargarVentas();
});

btnSiguiente.addEventListener("click", () => {
  if (pagina >= totalPaginas || cargando) return;
  pagina += 1;
  cargarVentas();
});

inicializarFechas();
cargarVentas();

function inicializarFechas() {
  const hoy = new Date();
  const fechaHoy = formatearFechaInputLocal(hoy);

  fechaInicio.value = fechaHoy;
  fechaFin.value = fechaHoy;
}

function seleccionarPeriodo(nuevoPeriodo) {
  periodo = nuevoPeriodo;
  pagina = 1;
  filtrosRango.classList.toggle("hidden", periodo !== "rango");
  actualizarBotonesPeriodo();
  cargarVentas();
}

function actualizarBotonesPeriodo() {
  const botones = [
    { boton: btnHoy, valor: "hoy" },
    { boton: btnAyer, valor: "ayer" },
    { boton: btnRango, valor: "rango" },
  ];

  botones.forEach(({ boton, valor }) => {
    const activo = periodo === valor;
    boton.className = activo
      ? "bg-green-500 text-black hover:bg-green-400 px-4 py-3 rounded-xl font-black"
      : "bg-zinc-800 hover:bg-zinc-700 px-4 py-3 rounded-xl font-bold";
  });
}

async function cargarVentas() {
  try {
    cargando = true;
    actualizarPaginacion({ total: 0, total_paginas: totalPaginas, pagina });
    resumenPaginacion.textContent = "Cargando ventas...";

    const params = new URLSearchParams({
      tienda_id: tiendaId,
      pagina,
      limite: LIMITE,
    });

    const texto = busqueda.value.trim();

    if (texto) {
      params.set("busqueda", texto);
    }

    if (periodo === "rango") {
      if (fechaInicio.value) params.set("fecha_inicio", fechaInicio.value);
      if (fechaFin.value) params.set("fecha_fin", fechaFin.value);
    } else {
      params.set("periodo", periodo);
    }

    const response = await fetch(`${API_URL}/ventas?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      tablaVentas.innerHTML = `
        <tr>
          <td colspan="7" class="p-5 text-center text-red-300">
            ${data.error || "Error al cargar ventas."}
          </td>
        </tr>
      `;
      return;
    }

    cargando = false;
    renderVentas(data.ventas || []);
    actualizarPaginacion(data.paginacion || {});
  } catch (error) {
    cargando = false;
    console.error(error);
    tablaVentas.innerHTML = `
      <tr>
        <td colspan="7" class="p-5 text-center text-red-300">
          Error al conectar.
        </td>
      </tr>
    `;
  } finally {
    cargando = false;
  }
}

function renderVentas(ventas) {
  tablaVentas.innerHTML = "";

  if (!ventas.length) {
    tablaVentas.innerHTML = `
      <tr>
        <td colspan="7" class="p-5 text-center text-zinc-500">
          No hay ventas para este filtro.
        </td>
      </tr>
    `;
    return;
  }

  ventas.forEach((venta) => {
    const tr = document.createElement("tr");
    const textoEstado = obtenerTextoEstado(venta.estado);
    const claseEstado = obtenerClaseEstado(venta.estado);

    tr.innerHTML = `
      <td class="p-3 font-semibold">${venta.folio}</td>
      <td class="p-3 text-green-400 font-bold">$${Number(venta.total).toFixed(2)}</td>
      <td class="p-3">${venta.metodo_pago}</td>
      <td class="p-3 text-zinc-400">${venta.usuario}</td>
      <td class="p-3">
        <span class="inline-flex px-3 py-1 rounded-full text-xs font-black ${claseEstado}">
          ${textoEstado}
        </span>
      </td>
      <td class="p-3 text-zinc-500 text-sm">${formatearFechaLocal(venta.fecha_venta)}</td>
      <td class="p-3">
        <button
          onclick="verDetalle(${venta.id})"
          class="bg-pink-500 hover:bg-pink-400 text-black px-4 py-2 rounded-xl font-bold"
        >
          Ver detalle
        </button>
      </td>
    `;

    tablaVentas.appendChild(tr);
  });
}

function actualizarPaginacion(paginacion) {
  pagina = Number(paginacion.pagina || pagina || 1);
  totalPaginas = Number(paginacion.total_paginas || 1);
  const total = Number(paginacion.total || 0);

  paginaActual.textContent = `Pagina ${pagina} de ${totalPaginas}`;
  resumenPaginacion.textContent =
    `${total} ventas encontradas. Mostrando hasta ${LIMITE} por pagina.`;

  btnAnterior.disabled = pagina <= 1 || cargando;
  btnSiguiente.disabled = pagina >= totalPaginas || cargando;
}

function verDetalle(id) {
  window.location.href = `./venta-detalle.html?id=${id}`;
}

function formatearFechaInputLocal(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function obtenerTextoEstado(estado) {
  if (estado === "devuelta_total") {
    return "Devuelta total";
  }

  if (estado === "devuelta_parcial") {
    return "Devuelta parcial";
  }

  if (estado === "cancelada") {
    return "Cancelada";
  }

  return "Completada";
}

function obtenerClaseEstado(estado) {
  if (estado === "devuelta_total") {
    return "bg-red-500/10 text-red-400 border border-red-500/30";
  }

  if (estado === "devuelta_parcial") {
    return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/30";
  }

  if (estado === "cancelada") {
    return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";
  }

  return "bg-green-500/10 text-green-400 border border-green-500/30";
}
