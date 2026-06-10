const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const producto = document.getElementById("producto");
const buscarProductoEntrada = document.getElementById("buscarProductoEntrada");
const resultadosProductoEntrada = document.getElementById("resultadosProductoEntrada");
const cantidad = document.getElementById("cantidad");
const grupoPiezasSueltas = document.getElementById("grupoPiezasSueltas");
const piezasSueltas = document.getElementById("piezasSueltas");
const labelPiezasSueltas = document.getElementById("labelPiezasSueltas");
const proveedor = document.getElementById("proveedor");
const costoUnitario = document.getElementById("costoUnitario");
const observaciones = document.getElementById("observaciones");
const btnRegistrar = document.getElementById("btnRegistrar");
const mensaje = document.getElementById("mensaje");
const resumenInventarioEntrada = document.getElementById("resumenInventarioEntrada");

let productos = [];
let inventario = [];

cargarProductos();
cargarInventario();

producto.addEventListener("change", () => {
  actualizarCampoCantidad();
  renderResumenInventarioEntrada();
});

cantidad.addEventListener("input", renderResumenInventarioEntrada);
piezasSueltas.addEventListener("input", renderResumenInventarioEntrada);

btnRegistrar.addEventListener("click", async () => {
  await registrarEntrada();
});

async function cargarProductos() {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    productos = await response.json();

    renderSelectProductos(productos);
    actualizarCampoCantidad();

  } catch (error) {
    mostrarMensaje("Error al cargar productos.");
  }
}

async function cargarInventario() {
  try {
    const response = await fetch(`${API_URL}/inventario/tienda/${tiendaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    inventario = await response.json();
    renderResumenInventarioEntrada();
  } catch (error) {
    inventario = [];
  }
}

function obtenerProductoSeleccionado() {
  return productos.find(
    (item) => Number(item.id) === Number(producto.value)
  );
}

function actualizarCampoCantidad() {
  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) return;

  if (productoSeleccionado.unidad === "kg") {
    cantidad.placeholder = "Cantidad EN GRAMOS. Ejemplo: 1000 = 1 kg";
    cantidad.title = "Este producto se registra en gramos y el sistema lo convierte a kg.";
    grupoPiezasSueltas.classList.add("hidden");
    piezasSueltas.value = "";
    renderResumenInventarioEntrada();
    return;
  }

  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);

  if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const nombrePaquete = productoSeleccionado.presentacion || productoSeleccionado.unidad;
    cantidad.placeholder = `Cantidad de ${nombrePaquete}s cerrados. Ejemplo: 1`;
    cantidad.title = `Registra paquetes cerrados y piezas sueltas por separado. Este producto trae ${unidadesPorPaquete} piezas por ${nombrePaquete}.`;
    grupoPiezasSueltas.classList.remove("hidden");
    labelPiezasSueltas.textContent = `Piezas sueltas (0 a ${unidadesPorPaquete - 1})`;
    piezasSueltas.max = String(unidadesPorPaquete - 1);
    renderResumenInventarioEntrada();
    return;
  }

  grupoPiezasSueltas.classList.add("hidden");
  piezasSueltas.value = "";
  cantidad.placeholder = "Cantidad EN PIEZAS. Ejemplo: 12";
  cantidad.title = "Este producto se registra por piezas.";
  renderResumenInventarioEntrada();
}

async function registrarEntrada() {
  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  let cantidadFinal = Number(cantidad.value || 0);
  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);

  if (productoSeleccionado.unidad === "kg") {
    if (!cantidadFinal || cantidadFinal <= 0) {
      mostrarMensaje("La cantidad es obligatoria.");
      return;
    }

    cantidadFinal = cantidadFinal / 1000;
  } else if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const piezas = Number(piezasSueltas.value || 0);

    if (!Number.isInteger(cantidadFinal) || cantidadFinal < 0) {
      mostrarMensaje("La cantidad de paquetes debe ser entera.");
      return;
    }

    if (!Number.isInteger(piezas) || piezas < 0 || piezas >= unidadesPorPaquete) {
      mostrarMensaje(`Las piezas sueltas deben estar entre 0 y ${unidadesPorPaquete - 1}.`);
      return;
    }

    if (cantidadFinal === 0 && piezas === 0) {
      mostrarMensaje("La cantidad es obligatoria.");
      return;
    }

    cantidadFinal += piezas / unidadesPorPaquete;
  } else if (!cantidadFinal || cantidadFinal <= 0) {
    mostrarMensaje("La cantidad es obligatoria.");
    return;
  }

  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    producto_id: Number(producto.value),
    cantidad: cantidadFinal,
    proveedor: proveedor.value.trim(),
    costo_unitario: Number(costoUnitario.value),
    observaciones: observaciones.value.trim(),
  };

  try {
    const response = await fetch(`${API_URL}/entradas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar entrada.");
      return;
    }

    mostrarMensaje("Entrada registrada correctamente.");

    limpiarFormulario();
    await cargarInventario();
    actualizarCampoCantidad();
    renderResumenInventarioEntrada();

  } catch (error) {
    console.error("ERROR REAL ENTRADAS:", error);
    mostrarMensaje("Error al conectar.");
  }
}

function limpiarFormulario() {
  cantidad.value = "";
  piezasSueltas.value = "";
  proveedor.value = "";
  costoUnitario.value = "";
  observaciones.value = "";
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}


function renderSelectProductos(lista) {
  producto.innerHTML = "";

  lista.forEach((item) => {
    const option = document.createElement("option");

    option.value = item.id;
    option.dataset.unidad = item.unidad;

    option.textContent = `${item.nombre} - ${item.presentacion || item.unidad}`;

    producto.appendChild(option);
  });

  actualizarCampoCantidad();
  if (productos.length > 0 && !buscarProductoEntrada.value) {
    seleccionarProductoEntrada(productos[0], false);
  }
}

function obtenerUnidadesPorPaquete(item) {
  const factor = Number(item.factor_conversion_derivado || 0);

  if (!factor || factor <= 0 || factor >= 1) {
    return 0;
  }

  return Math.round(1 / factor);
}

buscarProductoEntrada?.addEventListener("input", () => {
  renderResultadosProductoEntrada();
});

buscarProductoEntrada?.addEventListener("focus", () => {
  renderResultadosProductoEntrada();
});

document.addEventListener("click", (event) => {
  if (
    !buscarProductoEntrada?.contains(event.target) &&
    !resultadosProductoEntrada?.contains(event.target)
  ) {
    resultadosProductoEntrada?.classList.add("hidden");
  }
});

function renderResultadosProductoEntrada() {
  if (!resultadosProductoEntrada) return;

  const texto = normalizarTexto(buscarProductoEntrada.value);

  const filtrados = productos.filter((p) =>
    productoCoincideBusqueda(p, texto)
  ).slice(0, 10);

  resultadosProductoEntrada.innerHTML = "";

  if (filtrados.length === 0) {
    resultadosProductoEntrada.innerHTML = `
      <div class="p-4 text-sm text-zinc-500">No hay productos activos.</div>
    `;
    resultadosProductoEntrada.classList.remove("hidden");
    return;
  }

  filtrados.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "w-full text-left px-4 py-3 hover:bg-zinc-900 border-b border-zinc-800 last:border-b-0";
    button.innerHTML = `
      <div class="font-black">${item.nombre}</div>
      <div class="text-xs text-zinc-500">
        ${item.codigo_barras || "Sin codigo"}${item.marca ? ` - ${item.marca}` : ""}${item.categoria ? ` - ${item.categoria}` : ""}${item.presentacion ? ` - ${item.presentacion}` : ""}
      </div>
    `;
    button.addEventListener("click", () => seleccionarProductoEntrada(item));
    resultadosProductoEntrada.appendChild(button);
  });

  resultadosProductoEntrada.classList.remove("hidden");
}

function seleccionarProductoEntrada(item, enfocarCantidad = true) {
  producto.value = item.id;
  buscarProductoEntrada.value = `${item.nombre} - ${item.presentacion || item.unidad}`;
  resultadosProductoEntrada?.classList.add("hidden");
  actualizarCampoCantidad();
  renderResumenInventarioEntrada();

  if (enfocarCantidad) {
    cantidad.focus();
  }
}

function productoCoincideBusqueda(item, texto) {
  if (!texto) return true;

  return normalizarTexto([
    item.nombre,
    item.codigo_barras,
    item.categoria,
    item.marca,
    item.presentacion,
    item.unidad,
  ].join(" ")).includes(texto);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function obtenerInventarioProducto(productoId) {
  return inventario.find(
    (item) => Number(item.producto_id) === Number(productoId)
  );
}

function calcularCantidadEntradaPreview(productoSeleccionado) {
  const cantidadBase = Number(cantidad.value || 0);
  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);

  if (productoSeleccionado.unidad === "kg") {
    return cantidadBase > 0 ? cantidadBase / 1000 : 0;
  }

  if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const piezas = Number(piezasSueltas.value || 0);
    return Math.max(cantidadBase, 0) + Math.max(piezas, 0) / unidadesPorPaquete;
  }

  return cantidadBase > 0 ? cantidadBase : 0;
}

function formatearCantidadInventario(valor, productoSeleccionado) {
  const cantidadActual = Number(valor || 0);
  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);

  if (productoSeleccionado.unidad === "kg") {
    return `${quitarCeros(cantidadActual.toFixed(3))} kg`;
  }

  if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const paquetes = Math.floor(cantidadActual);
    const piezas = Math.round((cantidadActual - paquetes) * unidadesPorPaquete);
    const nombrePaquete = productoSeleccionado.presentacion || productoSeleccionado.unidad || "paquete";
    return `${paquetes} ${nombrePaquete}${paquetes === 1 ? "" : "s"}${piezas ? ` + ${piezas} pieza${piezas === 1 ? "" : "s"}` : ""}`;
  }

  return `${quitarCeros(cantidadActual.toFixed(3))} ${productoSeleccionado.unidad || "pieza"}`;
}

function renderResumenInventarioEntrada() {
  if (!resumenInventarioEntrada) return;

  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) {
    resumenInventarioEntrada.classList.add("hidden");
    resumenInventarioEntrada.innerHTML = "";
    return;
  }

  const inventarioProducto = obtenerInventarioProducto(productoSeleccionado.id);
  const actual = Number(inventarioProducto?.cantidad_actual || 0);
  const entrada = calcularCantidadEntradaPreview(productoSeleccionado);
  const despues = actual + entrada;
  const minimo = Number(inventarioProducto?.cantidad_minima || 0);
  const maximo = Number(inventarioProducto?.cantidad_maxima || 0);

  resumenInventarioEntrada.innerHTML = `
    <div class="border-b border-zinc-800 bg-zinc-900/60 px-5 py-4">
      <h3 class="text-xl font-black text-white">Inventario del producto</h3>
      <p class="text-sm text-slate-400">Existencia actual y total estimado despues de registrar esta entrada.</p>
    </div>

    <div class="grid gap-3 p-5 md:grid-cols-3">
      <div class="rounded-xl border border-zinc-800 bg-black p-4">
        <p class="text-xs font-bold uppercase text-slate-400">Actual</p>
        <p class="mt-2 text-2xl font-black text-white">${formatearCantidadInventario(actual, productoSeleccionado)}</p>
      </div>
      <div class="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4">
        <p class="text-xs font-bold uppercase text-purple-200">Entrada capturada</p>
        <p class="mt-2 text-2xl font-black text-purple-200">+ ${formatearCantidadInventario(entrada, productoSeleccionado)}</p>
      </div>
      <div class="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
        <p class="text-xs font-bold uppercase text-green-200">Quedaria</p>
        <p class="mt-2 text-2xl font-black text-green-300">${formatearCantidadInventario(despues, productoSeleccionado)}</p>
      </div>
    </div>

    <div class="overflow-x-auto border-t border-zinc-800">
      <table class="w-full text-left text-sm">
        <thead class="bg-zinc-900 text-white">
          <tr>
            <th class="px-5 py-3">Producto</th>
            <th class="px-5 py-3">Codigo</th>
            <th class="px-5 py-3">Tipo</th>
            <th class="px-5 py-3">Unidad</th>
            <th class="px-5 py-3">Minimo</th>
            <th class="px-5 py-3">Maximo</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-t border-zinc-800">
            <td class="px-5 py-3 font-black text-white">${productoSeleccionado.nombre}</td>
            <td class="px-5 py-3 text-slate-300">${productoSeleccionado.codigo_barras || "Sin codigo"}</td>
            <td class="px-5 py-3 text-slate-300">${productoSeleccionado.tipo_producto || "-"}</td>
            <td class="px-5 py-3 text-slate-300">${productoSeleccionado.presentacion || productoSeleccionado.unidad || "-"}</td>
            <td class="px-5 py-3 text-slate-300">${formatearCantidadInventario(minimo, productoSeleccionado)}</td>
            <td class="px-5 py-3 text-slate-300">${formatearCantidadInventario(maximo, productoSeleccionado)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  resumenInventarioEntrada.classList.remove("hidden");
}

function quitarCeros(valor) {
  const limpio = String(valor).replace(/\.?0+$/, "");
  return limpio || "0";
}
