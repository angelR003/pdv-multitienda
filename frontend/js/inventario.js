const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));

const tiendaId = Number(localStorage.getItem("tienda_id"));
const tiendaNombre = localStorage.getItem("tienda_nombre");

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const esAdmin = usuario.rol === "administrador";

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const tablaInventario = document.getElementById("tablaInventario");
const buscador = document.getElementById("buscador");
const filtroEstado = document.getElementById("filtroEstado");
const mensaje = document.getElementById("mensaje");
const modalLimites = document.getElementById("modalLimites");
const limitesProducto = document.getElementById("limitesProducto");
const limiteMinimo = document.getElementById("limiteMinimo");
const limiteMaximo = document.getElementById("limiteMaximo");
const btnGuardarLimites = document.getElementById("btnGuardarLimites");
const btnCerrarLimites = document.getElementById("btnCerrarLimites");

let inventarioEditandoId = null;

let inventario = [];

cargarInventario();

buscador.addEventListener("input", renderInventario);
filtroEstado.addEventListener("change", renderInventario);

btnCerrarLimites.addEventListener("click", cerrarModalLimites);

btnGuardarLimites.addEventListener("click", guardarLimites);

async function cargarInventario() {
  try {
    const response = await fetch(
      `${API_URL}/inventario/tienda/${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar inventario.");
      return;
    }

    inventario = data;
    renderInventario();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function renderInventario() {
  const texto = buscador.value.toLowerCase().trim();
  const estado = filtroEstado.value;

  const filtrado = inventario.filter((item) => {
    const coincideTexto =
      item.producto.toLowerCase().includes(texto) ||
      (item.codigo_barras || "").includes(texto);

    const estaBajo = item.cantidad_actual <= item.cantidad_minima;

    if (estado === "bajo") return coincideTexto && estaBajo;
    if (estado === "ok") return coincideTexto && !estaBajo;

    return coincideTexto;
  });

  tablaInventario.innerHTML = "";

  filtrado.forEach((item) => {
    const estaBajo = item.cantidad_actual <= item.cantidad_minima;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-semibold">
        ${item.producto}
        <div class="text-xs text-zinc-500">
          ${item.codigo_barras || "Sin código"}
        </div>
      </td>

      <td class="p-3 text-zinc-300">
        ${item.tipo_producto}
      </td>

      <td class="p-3 text-xl font-bold">
        ${formatearCantidad(item.cantidad_actual)} ${item.unidad}
      </td>

      <td class="p-3 text-zinc-300">
        ${formatearCantidad(item.cantidad_minima)}
      </td>

      <td class="p-3 text-zinc-300">
        ${formatearCantidad(item.cantidad_maxima)}
      </td>

      <td class="p-3">
        <span class="${
          estaBajo
            ? "bg-red-500/20 text-red-300 border-red-500/30"
            : "bg-green-500/20 text-green-300 border-green-500/30"
        } border px-3 py-1 rounded-full text-xs font-bold">
          ${estaBajo ? "BAJO" : "OK"}
        </span>
      </td>
 <td class="p-3">
  ${
    esAdmin
      ? `
        <button
          class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold"
          onclick="abrirModalLimites(${item.id})"
        >
          Límites
        </button>
      `
      : `<span class="text-zinc-500 text-sm">Solo admin</span>`
  }
</td>
    `;

    tablaInventario.appendChild(tr);
  });

  if (filtrado.length === 0) {
    tablaInventario.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-zinc-500">
          No se encontraron productos.
        </td>
      </tr>
    `;
  }
}

function formatearCantidad(valor) {
  return Number(valor)
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function abrirModalLimites(id) {
  const item = inventario.find((producto) => producto.id === id);

  if (!item) return;

  inventarioEditandoId = item.id;

  limitesProducto.textContent = item.producto;

  limiteMinimo.value = item.cantidad_minima;
  limiteMaximo.value = item.cantidad_maxima;

  modalLimites.classList.remove("hidden");
  modalLimites.classList.add("flex");
}

function cerrarModalLimites() {
  inventarioEditandoId = null;

  limiteMinimo.value = "";
  limiteMaximo.value = "";

  modalLimites.classList.add("hidden");
  modalLimites.classList.remove("flex");
}

async function guardarLimites() {
  if (!inventarioEditandoId) return;

  const body = {
    cantidad_minima: Number(limiteMinimo.value),
    cantidad_maxima: Number(limiteMaximo.value),
  };

  try {
    const response = await fetch(
      `${API_URL}/inventario/${inventarioEditandoId}/limites`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al actualizar límites.");
      return;
    }

    mostrarMensaje("Límites actualizados correctamente.");

    cerrarModalLimites();

    await cargarInventario();

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}