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

let productos = [];

cargarProductos();

producto.addEventListener("change", actualizarCampoCantidad);

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
    return;
  }

  grupoPiezasSueltas.classList.add("hidden");
  piezasSueltas.value = "";
  cantidad.placeholder = "Cantidad EN PIEZAS. Ejemplo: 12";
  cantidad.title = "Este producto se registra por piezas.";
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
    actualizarCampoCantidad();

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
