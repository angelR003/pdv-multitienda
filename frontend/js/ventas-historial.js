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

  const filtradas = ventas.filter((venta) =>
    venta.folio.toLowerCase().includes(texto)
  );

  tablaVentas.innerHTML = "";

  filtradas.forEach((venta) => {
    const tr = document.createElement("tr");

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
  return new Date(fecha.replace(" ", "T") + "Z").toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}