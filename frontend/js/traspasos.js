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

const esAdmin = usuario.rol === "administrador";

const panelCrearTraspaso = document.getElementById("panelCrearTraspaso");
const tiendaOrigen = document.getElementById("tiendaOrigen");
const tiendaDestino = document.getElementById("tiendaDestino");
const motivoTraspaso = document.getElementById("motivoTraspaso");
const buscadorProductoTraspaso = document.getElementById("buscadorProductoTraspaso");
const resultadosProductoTraspaso = document.getElementById("resultadosProductoTraspaso");
const cantidadTraspaso = document.getElementById("cantidadTraspaso");
const btnAgregarProducto = document.getElementById("btnAgregarProducto");
const btnEnviarTraspaso = document.getElementById("btnEnviarTraspaso");
const tablaProductosTraspaso = document.getElementById("tablaProductosTraspaso");
const tablaTraspasos = document.getElementById("tablaTraspasos");
const filtroEstado = document.getElementById("filtroEstado");
const mensaje = document.getElementById("mensaje");

let tiendas = [];
let productosOrigen = [];
let productosTraspaso = [];
let traspasos = [];
let productoSeleccionadoTraspasoId = null;

if (!esAdmin) {
  panelCrearTraspaso.remove();
}

btnAgregarProducto?.addEventListener("click", agregarProductoTraspaso);
btnEnviarTraspaso?.addEventListener("click", enviarTraspaso);
tiendaOrigen?.addEventListener("change", async () => {
  productosTraspaso = [];
  renderProductosTraspaso();
  await cargarProductosOrigen();
});
filtroEstado.addEventListener("change", renderTraspasos);
buscadorProductoTraspaso?.addEventListener("input", () => {
  productoSeleccionadoTraspasoId = null;
  renderResultadosProductoTraspaso();
});
buscadorProductoTraspaso?.addEventListener("focus", renderResultadosProductoTraspaso);
document.addEventListener("click", (event) => {
  if (
    !buscadorProductoTraspaso?.contains(event.target) &&
    !resultadosProductoTraspaso?.contains(event.target)
  ) {
    resultadosProductoTraspaso?.classList.add("hidden");
  }
});

inicializar();

async function inicializar() {
  await cargarTiendas();
  await cargarTraspasos();

  if (esAdmin) {
    await cargarProductosOrigen();
  }
}

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

async function cargarTiendas() {
  try {
    tiendas = await fetchJson(`${API_URL}/traspasos/tiendas`);

    tiendaOrigen.innerHTML = "";
    tiendaDestino.innerHTML = "";

    tiendas.forEach((tienda) => {
      const optionOrigen = document.createElement("option");
      optionOrigen.value = tienda.id;
      optionOrigen.textContent = tienda.nombre;

      const optionDestino = document.createElement("option");
      optionDestino.value = tienda.id;
      optionDestino.textContent = tienda.nombre;

      tiendaOrigen.appendChild(optionOrigen);
      tiendaDestino.appendChild(optionDestino);
    });

    tiendaOrigen.value = tiendaId;

    const destinoDisponible = tiendas.find(
      (tienda) => Number(tienda.id) !== Number(tiendaId)
    );

    if (destinoDisponible) {
      tiendaDestino.value = destinoDisponible.id;
    }
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

async function cargarProductosOrigen() {
  if (!tiendaOrigen.value) return;

  try {
    productosOrigen = await fetchJson(
      `${API_URL}/traspasos/productos?tienda_id=${tiendaOrigen.value}`
    );

    productoSeleccionadoTraspasoId = null;
    buscadorProductoTraspaso.value = "";
    resultadosProductoTraspaso.innerHTML = "";
    resultadosProductoTraspaso.classList.add("hidden");
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

function renderResultadosProductoTraspaso() {
  if (!resultadosProductoTraspaso) return;

  const busqueda = normalizarTexto(buscadorProductoTraspaso.value);

  const productosFiltrados = productosOrigen
    .filter((producto) => productoCoincideBusqueda(producto, busqueda))
    .slice(0, 10);

  resultadosProductoTraspaso.innerHTML = "";

  if (productosFiltrados.length === 0) {
    resultadosProductoTraspaso.innerHTML = `
      <div class="p-4 text-sm text-zinc-500">
        No hay productos activos con existencia en la tienda origen.
      </div>
    `;
    resultadosProductoTraspaso.classList.remove("hidden");
    return;
  }

  productosFiltrados.forEach((producto) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "w-full text-left px-4 py-3 hover:bg-zinc-900 border-b border-zinc-800 last:border-b-0";

    button.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-black">${producto.nombre}</p>
          <p class="text-xs text-zinc-500">
            ${producto.codigo_barras || "Sin codigo"}${producto.marca ? ` - ${producto.marca}` : ""}${producto.categoria ? ` - ${producto.categoria}` : ""}
          </p>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold text-green-300">
            ${formatearCantidad(producto.cantidad_actual, producto.unidad)} ${producto.unidad}
          </p>
          <p class="text-xs text-zinc-500">Disponible</p>
        </div>
      </div>
    `;

    button.addEventListener("click", () => {
      seleccionarProductoTraspaso(producto);
    });

    resultadosProductoTraspaso.appendChild(button);
  });

  resultadosProductoTraspaso.classList.remove("hidden");
}

function productoCoincideBusqueda(producto, busqueda) {
  if (!busqueda) {
    return true;
  }

  const texto = normalizarTexto(
    [
      producto.nombre,
      producto.marca,
      producto.categoria,
      producto.codigo_barras,
    ].join(" ")
  );

  return texto.includes(busqueda);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function seleccionarProductoTraspaso(producto) {
  productoSeleccionadoTraspasoId = Number(producto.id);
  buscadorProductoTraspaso.value = `${producto.nombre} - ${formatearCantidad(producto.cantidad_actual, producto.unidad)} ${producto.unidad}`;
  resultadosProductoTraspaso.classList.add("hidden");
  cantidadTraspaso.focus();
}

function agregarProductoTraspaso() {
  const productoId = Number(productoSeleccionadoTraspasoId);
  const cantidad = Number(cantidadTraspaso.value);

  const producto = productosOrigen.find(
    (item) => Number(item.id) === productoId
  );

  if (!producto) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  if (!cantidad || cantidad <= 0) {
    mostrarMensaje("La cantidad debe ser mayor a 0.");
    return;
  }

  const permiteDecimal =
    producto.tipo_producto === "peso_variable" ||
    Number(producto.es_derivado || 0) === 1;

  if (!permiteDecimal && !Number.isInteger(cantidad)) {
    mostrarMensaje(`La cantidad de ${producto.nombre} debe ser entera.`);
    return;
  }

  if (cantidad > Number(producto.cantidad_actual)) {
    mostrarMensaje(`No hay suficiente existencia de ${producto.nombre}.`);
    return;
  }

  const existente = productosTraspaso.find(
    (item) => Number(item.producto_id) === productoId
  );

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    productosTraspaso.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      disponible: Number(producto.cantidad_actual),
      cantidad,
    });
  }

  cantidadTraspaso.value = "";
  productoSeleccionadoTraspasoId = null;
  buscadorProductoTraspaso.value = "";
  buscadorProductoTraspaso.focus();
  renderProductosTraspaso();
}

function renderProductosTraspaso() {
  tablaProductosTraspaso.innerHTML = "";

  productosTraspaso.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-bold">${item.nombre}</td>
      <td class="p-3 text-zinc-400">${formatearCantidad(item.disponible, item.unidad)} ${item.unidad}</td>
      <td class="p-3">${formatearCantidad(item.cantidad, item.unidad)} ${item.unidad}</td>
      <td class="p-3 text-right">
        <button
          class="bg-red-500 hover:bg-red-400 text-black px-4 py-2 rounded-xl font-bold"
          onclick="quitarProductoTraspaso(${item.producto_id})"
        >
          Quitar
        </button>
      </td>
    `;

    tablaProductosTraspaso.appendChild(tr);
  });

  if (productosTraspaso.length === 0) {
    tablaProductosTraspaso.innerHTML = `
      <tr>
        <td colspan="4" class="p-5 text-center text-zinc-500">
          Agrega productos al traspaso.
        </td>
      </tr>
    `;
  }
}

function quitarProductoTraspaso(productoId) {
  productosTraspaso = productosTraspaso.filter(
    (item) => Number(item.producto_id) !== Number(productoId)
  );

  renderProductosTraspaso();
}

async function enviarTraspaso() {
  if (!esAdmin) return;

  if (Number(tiendaOrigen.value) === Number(tiendaDestino.value)) {
    mostrarMensaje("Origen y destino deben ser diferentes.");
    return;
  }

  if (productosTraspaso.length === 0) {
    mostrarMensaje("Agrega al menos un producto.");
    return;
  }

  const body = {
    tienda_origen_id: Number(tiendaOrigen.value),
    tienda_destino_id: Number(tiendaDestino.value),
    motivo: motivoTraspaso.value.trim(),
    productos: productosTraspaso.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    })),
  };

  try {
    const data = await fetchJson(`${API_URL}/traspasos`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    mostrarMensaje(data.mensaje || "Traspaso enviado correctamente.");

    motivoTraspaso.value = "";
    productosTraspaso = [];
    renderProductosTraspaso();

    await cargarProductosOrigen();
    await cargarTraspasos();
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

async function cargarTraspasos() {
  try {
    traspasos = await fetchJson(`${API_URL}/traspasos`);
    renderTraspasos();
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

function renderTraspasos() {
  const estado = filtroEstado.value;

  const filtrados = estado
    ? traspasos.filter((traspaso) => traspaso.estado === estado)
    : traspasos;

  tablaTraspasos.innerHTML = "";

  filtrados.forEach((traspaso) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-bold">#${traspaso.id}</td>
      <td class="p-3">${traspaso.tienda_origen}</td>
      <td class="p-3">${traspaso.tienda_destino}</td>
      <td class="p-3">
        <span class="${claseEstado(traspaso.estado)} px-3 py-1 rounded-full text-xs font-bold">
          ${traspaso.estado}
        </span>
      </td>
      <td class="p-3 text-zinc-400">${formatearFechaLocal(traspaso.fecha_envio)}</td>
      <td class="p-3 text-right">
        <a
          href="./traspaso-detalle.html?id=${traspaso.id}"
          class="bg-blue-500 hover:bg-blue-400 text-black px-4 py-2 rounded-xl font-bold"
        >
          Ver
        </a>
      </td>
    `;

    tablaTraspasos.appendChild(tr);
  });

  if (filtrados.length === 0) {
    tablaTraspasos.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-zinc-500">
          No hay traspasos para mostrar.
        </td>
      </tr>
    `;
  }
}

function claseEstado(estado) {
  if (estado === "enviado") {
    return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
  }

  if (estado === "recibido") {
    return "bg-green-500/20 text-green-300 border border-green-500/30";
  }

  if (estado === "cancelado") {
    return "bg-red-500/20 text-red-300 border border-red-500/30";
  }

  return "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30";
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

renderProductosTraspaso();
