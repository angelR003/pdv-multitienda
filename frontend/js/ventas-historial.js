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

let ventas = [];

busqueda.addEventListener("input", renderVentas);

cargarVentas();

async function cargarVentas() {
  try {
    const response = await fetch(`${API_URL}/ventas?tienda_id=${tiendaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    ventas = await response.json();

    renderVentas();

  } catch (error) {
    console.error(error);
  }
}

function renderVentas() {
  const texto = busqueda.value.toLowerCase().trim();

const filtradas = ventas.filter((venta) => {
  const estadoTexto = obtenerTextoEstado(venta.estado).toLowerCase();

  return (
    venta.folio.toLowerCase().includes(texto) ||
    String(venta.usuario || "").toLowerCase().includes(texto) ||
    String(venta.metodo_pago || "").toLowerCase().includes(texto) ||
    estadoTexto.includes(texto)
  );
});

  tablaVentas.innerHTML = "";

  filtradas.forEach((venta) => {
    const tr = document.createElement("tr");
    const textoEstado = obtenerTextoEstado(venta.estado);
    const claseEstado = obtenerClaseEstado(venta.estado);

tr.innerHTML = `
  <td class="p-3 font-semibold">
    ${venta.folio}
  </td>

  <td class="p-3 text-green-400 font-bold">
    $${Number(venta.total).toFixed(2)}
  </td>

  <td class="p-3">
    ${venta.metodo_pago}
  </td>

  <td class="p-3 text-zinc-400">
    ${venta.usuario}
  </td>

  <td class="p-3">
    <span class="inline-flex px-3 py-1 rounded-full text-xs font-black ${claseEstado}">
      ${textoEstado}
    </span>
  </td>

  <td class="p-3 text-zinc-500 text-sm">
    ${formatearFechaLocal(venta.fecha_venta)}
  </td>

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

function verDetalle(id) {
  window.location.href =
    `./venta-detalle.html?id=${id}`;
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
