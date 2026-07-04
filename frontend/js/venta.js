document.addEventListener("submit", (event) => {
  event.preventDefault();
  event.stopPropagation();
  console.log("Submit bloqueado");
});

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

const tiendaNombre = localStorage.getItem("tienda_nombre");

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}
const esAdmin = usuario.rol === "administrador";

const pagoCon = document.getElementById("pagoCon");
const cambioVenta = document.getElementById("cambioVenta");

const usuarioNombre = document.getElementById("usuarioNombre");
const usuarioRol = document.getElementById("usuarioRol");
const btnLogout = document.getElementById("btnLogout");

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const API_URL = "http://localhost:3000/api";

const codigoInput = document.getElementById("codigoInput");
const resultadosBusquedaManual = document.getElementById("resultadosBusquedaManual");
const carritoTabla = document.getElementById("carritoTabla");
const totalVenta = document.getElementById("totalVenta");
const totalProductos = document.getElementById("totalProductos");
const metodoPago = document.getElementById("metodoPago");
const btnCobrar = document.getElementById("btnCobrar");
const btnLimpiar = document.getElementById("btnLimpiar");
const mensaje = document.getElementById("mensaje");
const btnProductoManual = document.getElementById("btnProductoManual");
const modalManual = document.getElementById("modalManual");
const manualProducto = document.getElementById("manualProducto");
const manualCantidad = document.getElementById("manualCantidad");
const btnAgregarManual = document.getElementById("btnAgregarManual");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const grupoClienteFiado = document.getElementById("grupoClienteFiado");
const clienteFiado = document.getElementById("clienteFiado");
const formNuevoDeudorVenta = document.getElementById("formNuevoDeudorVenta");
const btnGuardarNuevoDeudorVenta = document.getElementById(
  "btnGuardarNuevoDeudorVenta",
);
const nuevoDeudorNombre = document.getElementById("nuevoDeudorNombre");
const nuevoDeudorApodo = document.getElementById("nuevoDeudorApodo");
const nuevoDeudorTelefono = document.getElementById("nuevoDeudorTelefono");
const nuevoDeudorLimite = document.getElementById("nuevoDeudorLimite");
const btnProductoSuelto = document.getElementById("btnProductoSuelto");
const btnServicioElectronico = document.getElementById("btnServicioElectronico");
const modalServicioElectronico = document.getElementById("modalServicioElectronico");
const btnTabRecarga = document.getElementById("btnTabRecarga");
const btnTabServicio = document.getElementById("btnTabServicio");
const panelRecarga = document.getElementById("panelRecarga");
const panelServicio = document.getElementById("panelServicio");
const montosRecarga = document.getElementById("montosRecarga");
const montoServicioElectronico = document.getElementById("montoServicioElectronico");
const btnAgregarServicioElectronico = document.getElementById("btnAgregarServicioElectronico");
const btnCerrarServicioElectronico = document.getElementById("btnCerrarServicioElectronico");
const mensajeServicioElectronico = document.getElementById("mensajeServicioElectronico");
const modalEnvasesVenta = document.getElementById("modalEnvasesVenta");
const listaEnvasesVenta = document.getElementById("listaEnvasesVenta");
const resumenImportesEnvasesVenta = document.getElementById("resumenImportesEnvasesVenta");
const resumenEnvasesProductos = document.getElementById("resumenEnvasesProductos");
const resumenEnvasesImportes = document.getElementById("resumenEnvasesImportes");
const resumenEnvasesTotalCobrar = document.getElementById("resumenEnvasesTotalCobrar");
const btnConfirmarEnvasesVenta = document.getElementById("btnConfirmarEnvasesVenta");
const btnCancelarEnvasesVenta = document.getElementById("btnCancelarEnvasesVenta");
const modalPagoMixto = document.getElementById("modalPagoMixto");
const pagoMixtoTotalProductos = document.getElementById("pagoMixtoTotalProductos");
const pagoMixtoTotalImportes = document.getElementById("pagoMixtoTotalImportes");
const pagoMixtoRestante = document.getElementById("pagoMixtoRestante");
const pagoMixtoEfectivo = document.getElementById("pagoMixtoEfectivo");
const pagoMixtoTransferencia = document.getElementById("pagoMixtoTransferencia");
const pagoMixtoFiado = document.getElementById("pagoMixtoFiado");
const grupoPagoMixtoCliente = document.getElementById("grupoPagoMixtoCliente");
const pagoMixtoCliente = document.getElementById("pagoMixtoCliente");
const pagoMixtoObservaciones = document.getElementById("pagoMixtoObservaciones");
const mensajePagoMixto = document.getElementById("mensajePagoMixto");
const btnConfirmarPagoMixto = document.getElementById("btnConfirmarPagoMixto");
const btnCancelarPagoMixto = document.getElementById("btnCancelarPagoMixto");
const tituloModalManual = document.getElementById("tituloModalManual");
const labelCantidadManual = document.getElementById("labelCantidadManual");

let clientesFiado = [];
let carrito = [];
let productosManualSimple = [];
let timeoutBusquedaManual = null;
let modoModalProducto = "peso";
let promocionesActivas = [];
let resolverEnvasesVenta = null;
let resolverPagoMixto = null;
let totalPagoMixtoActual = 0;
let consecutivoLineaEspecial = 1;
let ventaEnProceso = false;
const redondeoOperativo = window.RedondeoOperativo;
const importesEnvases = window.ImportesEnvases;
let tiposEnvaseVenta = [];
let overflowBodyAntesModalEnvases = "";

const usuarioId = usuario.id;

usuarioNombre.textContent = usuario.nombre;
usuarioRol.textContent = `${usuario.rol} • ${usuario.tienda}`;

btnLogout.addEventListener("click", cerrarSesion);

codigoInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();

  const texto = codigoInput.value.trim();

  if (!texto) return;

  const agregadoPorCodigo = await buscarProductoPorCodigo(texto);

  if (!agregadoPorCodigo) {
    await cargarProductosManualSimple();
    const coincidencias = filtrarProductosManualSimple(texto);

    if (coincidencias.length === 1) {
      agregarProductoManualSimpleAlCarrito(coincidencias[0]);
    } else if (coincidencias.length > 1) {
      renderResultadosBusquedaManual(coincidencias);
      mostrarMensaje("Selecciona el producto manual de la lista.");
      return;
    } else {
      mostrarMensaje("Producto no encontrado.");
      return;
    }
  }

  codigoInput.value = "";
  ocultarResultadosBusquedaManual();
  codigoInput.focus();
});

codigoInput.addEventListener("input", () => {
  clearTimeout(timeoutBusquedaManual);

  timeoutBusquedaManual = setTimeout(async () => {
    const texto = codigoInput.value.trim();

    if (texto.length < 2) {
      ocultarResultadosBusquedaManual();
      return;
    }

    await cargarProductosManualSimple();
    renderResultadosBusquedaManual(filtrarProductosManualSimple(texto));
  }, 150);
});

btnCobrar.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  await cobrarVenta();
});

btnLimpiar.addEventListener("click", (event) => {
  event.preventDefault();
  carrito = [];
  reiniciarEstadoPagoVenta();
  ocultarResultadosBusquedaManual();
  renderCarrito();
  mostrarMensaje("Venta limpiada.");
});

pagoCon.addEventListener("input", calcularCambio);
pagoCon.addEventListener("change", calcularCambio);

btnProductoManual.addEventListener("click", async () => {
  modoModalProducto = "peso";
  tituloModalManual.textContent = "Producto a granel";
labelCantidadManual.textContent = "Cantidad / gramos";
manualCantidad.step = "0.001";
  modalManual.classList.remove("hidden");
  modalManual.classList.add("flex");
  manualCantidad.placeholder = "Ejemplo: 250 gramos";

  await cargarProductosManuales("peso");
});

btnCerrarModal.addEventListener("click", () => {
  cerrarModalManual();
});

btnAgregarManual.addEventListener("click", () => {
  agregarProductoManual();
});

metodoPago.addEventListener("change", () => {
  if (metodoPago.value === "fiado") {
    grupoClienteFiado.classList.remove("hidden");

    cargarClientesFiado();
  } else {
    grupoClienteFiado.classList.add("hidden");
    clienteFiado.value = "";
    formNuevoDeudorVenta.classList.add("hidden");
  }
});

clienteFiado.addEventListener("change", () => {
  if (clienteFiado.value === "nuevo") {
    formNuevoDeudorVenta.classList.remove("hidden");
  } else {
    formNuevoDeudorVenta.classList.add("hidden");
  }
});

btnProductoSuelto.addEventListener("click", async () => {
  modoModalProducto = "suelto";
  tituloModalManual.textContent = "Producto suelto";
labelCantidadManual.textContent = "Cantidad / piezas";
manualCantidad.step = "1";
  modalManual.classList.remove("hidden");
  modalManual.classList.add("flex");
  manualCantidad.placeholder = "Ejemplo: 1 pieza";

  await cargarProductosManuales("suelto");
});

btnServicioElectronico?.addEventListener("click", () => {
  abrirModalServicioElectronico("recarga");
});

btnTabRecarga?.addEventListener("click", () => {
  mostrarPanelServicioElectronico("recarga");
});

btnTabServicio?.addEventListener("click", () => {
  mostrarPanelServicioElectronico("servicio");
});

btnAgregarServicioElectronico?.addEventListener("click", () => {
  const monto = Number(montoServicioElectronico.value);

  if (!monto || monto <= 0) {
    mensajeServicioElectronico.textContent = "Captura un monto valido.";
    return;
  }

  agregarServicioAlCarrito("servicio", monto);
});

btnCerrarServicioElectronico?.addEventListener("click", cerrarModalServicioElectronico);

btnGuardarNuevoDeudorVenta.addEventListener("click", crearDeudorDesdeVenta);
cargarPromocionesActivas();
renderBotonesRecarga();

async function buscarProductoPorCodigo(codigo) {
  try {
    const response = await fetch(
      `${API_URL}/productos/codigo/${codigo}?tienda_id=${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return false;
    }

    agregarAlCarrito(data);
    mostrarMensaje(`${data.nombre} agregado.`);
    return true;
  } catch (error) {
    console.error("Error real al buscar producto:", error);
    mostrarMensaje("Error al buscar producto.");
    return false;
  }
}

async function cargarProductosManualSimple() {
  if (productosManualSimple.length > 0) {
    return productosManualSimple;
  }

  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const productos = await response.json();

    if (!response.ok || !Array.isArray(productos)) {
      productosManualSimple = [];
      return productosManualSimple;
    }

    productosManualSimple = productos.filter((producto) =>
      producto.tipo_producto === "manual" &&
      Number(producto.es_derivado || 0) !== 1
    );

    return productosManualSimple;
  } catch (error) {
    productosManualSimple = [];
    return productosManualSimple;
  }
}

function filtrarProductosManualSimple(texto) {
  const busqueda = normalizarBusqueda(texto);

  if (!busqueda) return [];

  return productosManualSimple
    .filter((producto) => {
      const campos = [
        producto.nombre,
        producto.codigo_barras,
        producto.categoria,
        producto.marca,
        producto.presentacion,
      ].map(normalizarBusqueda);

      return campos.some((campo) => campo.includes(busqueda));
    })
    .slice(0, 8);
}

function normalizarBusqueda(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function renderResultadosBusquedaManual(resultados) {
  if (!resultadosBusquedaManual) return;

  resultadosBusquedaManual.innerHTML = "";

  if (!resultados.length) {
    ocultarResultadosBusquedaManual();
    return;
  }

  resultados.forEach((producto) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-900 border-b border-zinc-800 last:border-b-0";
    button.innerHTML = `
      <span>
        <span class="block font-bold text-white">${producto.nombre}</span>
        <span class="block text-xs text-zinc-500">
          ${[producto.codigo_barras, producto.marca, producto.categoria, producto.presentacion]
            .filter(Boolean)
            .join(" - ") || "Manual sin codigo"}
        </span>
      </span>
      <span class="text-right">
        <span class="block font-black text-green-400">$${Number(producto.precio_global || 0).toFixed(2)}</span>
        <span class="block text-xs text-zinc-500">${producto.unidad || "pieza"}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      agregarProductoManualSimpleAlCarrito(producto);
      codigoInput.value = "";
      ocultarResultadosBusquedaManual();
      codigoInput.focus();
    });
    resultadosBusquedaManual.appendChild(button);
  });

  resultadosBusquedaManual.classList.remove("hidden");
}

function ocultarResultadosBusquedaManual() {
  if (!resultadosBusquedaManual) return;

  resultadosBusquedaManual.classList.add("hidden");
  resultadosBusquedaManual.innerHTML = "";
}

function agregarProductoManualSimpleAlCarrito(producto) {
  agregarAlCarrito({
    ...producto,
    precio_aplicable: producto.precio_global,
    tipo_producto: "manual",
    unidad: producto.unidad || "pieza",
    es_derivado: 0,
  });

  mostrarMensaje(`${producto.nombre} agregado.`);
}

async function cargarProductosManuales(modo = "peso") {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const productos = await response.json();

    if (!response.ok) {
      mostrarMensaje(productos.error || "Error al cargar productos.");
      return;
    }

    manualProducto.innerHTML = "";

    const filtrados = productos.filter((producto) => {
      if (modo === "peso") {
        return producto.tipo_producto === "peso_variable";
      }

      if (modo === "suelto") {
        return Number(producto.es_derivado) === 1;
      }

      if (modo === "manual") {
        return producto.tipo_producto === "manual" &&
          Number(producto.es_derivado || 0) !== 1;
      }

      return false;
    });

    filtrados.forEach((producto) => {
      const option = document.createElement("option");

      option.value = producto.id;
      option.textContent = `${producto.nombre} - $${Number(producto.precio_global).toFixed(2)}/${producto.unidad}`;

option.dataset.precio = producto.precio_global;
option.dataset.nombre = producto.nombre;
option.dataset.tipoProducto = producto.tipo_producto;
option.dataset.unidad = producto.unidad || "";
option.dataset.esRetornable = producto.es_retornable || 0;
option.dataset.tipoEnvaseId = producto.tipo_envase_id || "";

      manualProducto.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando productos:", error);
    mostrarMensaje("Error al cargar productos.");
  }
}

function agregarProductoManual() {
  const option = manualProducto.selectedOptions[0];

  if (!option) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  const producto_id = Number(option.value);
  const nombre = option.dataset.nombre;
  const precio = Number(option.dataset.precio);

  let cantidad = Number(manualCantidad.value);

  if (!cantidad || cantidad <= 0) {
    mostrarMensaje("Cantidad inválida.");
    return;
  }
  if (
    ["suelto", "manual"].includes(modoModalProducto) &&
    !Number.isInteger(cantidad)
  ) {
  mostrarMensaje("La cantidad debe ser una pieza completa.");
  return;
}

  if (modoModalProducto === "peso") {
    cantidad = cantidad / 1000;
  }

  const datosProducto = {
    tipo_producto:
      option.dataset.tipoProducto ||
      (modoModalProducto === "peso" ? "peso_variable" : "manual"),
    unidad: option.dataset.unidad || (modoModalProducto === "peso" ? "kg" : "pieza"),
  };

  const subtotal = calcularSubtotalOperativo(datosProducto, cantidad * precio);

agregarItemAlInicio({
  producto_id,
  nombre,
  cantidad,
  precio_unitario: precio,
  precio_unitario_original: precio,
  tipo_producto: datosProducto.tipo_producto,
  unidad: datosProducto.unidad,
  subtotal,
  promocion_aplicada: false,
  texto_promocion: "",
  descuento_promocion: 0,
  es_retornable: Number(option.dataset.esRetornable || 0),
  tipo_envase_id: option.dataset.tipoEnvaseId
    ? Number(option.dataset.tipoEnvaseId)
    : null,
});

recalcularCarrito();
renderCarrito();

  mostrarMensaje(`${nombre} agregado.`);

  cerrarModalManual();
}

function cerrarModalManual() {
  modalManual.classList.add("hidden");
  modalManual.classList.remove("flex");

  manualCantidad.value = "";
}

function renderBotonesRecarga() {
  if (!montosRecarga) return;

  const montos = [10, 15, 20, 25, 30, 50, 100, 200, 500];
  montosRecarga.innerHTML = "";

  montos.forEach((monto) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bg-zinc-950 hover:bg-green-500 hover:text-black border border-zinc-700 rounded-xl py-4 font-black transition";
    button.style.cssText = "border: 1px solid #3f3f46; border-radius: 12px; padding: 12px 8px; background: #09090b; font-weight: 900;";
    button.innerHTML = `
      <span class="block text-xl">$${monto}</span>
      <span class="block text-xs text-zinc-400">cobra $${(monto + 1).toFixed(2)}</span>
    `;
    button.addEventListener("click", () => agregarServicioAlCarrito("recarga", monto));
    montosRecarga.appendChild(button);
  });
}

function abrirModalServicioElectronico(tipo) {
  mensajeServicioElectronico.textContent = "";
  montoServicioElectronico.value = "";
  mostrarPanelServicioElectronico(tipo);
  modalServicioElectronico.classList.remove("hidden");
  modalServicioElectronico.classList.add("flex");
}

function cerrarModalServicioElectronico() {
  modalServicioElectronico.classList.add("hidden");
  modalServicioElectronico.classList.remove("flex");
  montoServicioElectronico.value = "";
}

function mostrarPanelServicioElectronico(tipo) {
  const esRecarga = tipo === "recarga";

  panelRecarga.classList.toggle("hidden", !esRecarga);
  panelServicio.classList.toggle("hidden", esRecarga);
  btnTabRecarga.className = esRecarga
    ? "rounded-xl py-3 font-bold bg-green-500 text-black"
    : "rounded-xl py-3 font-bold bg-zinc-800 text-white";
  btnTabServicio.className = esRecarga
    ? "rounded-xl py-3 font-bold bg-zinc-800 text-white"
    : "rounded-xl py-3 font-bold bg-green-500 text-black";
}

function agregarServicioAlCarrito(tipo, montoBase) {
  const monto = redondearCentavos(montoBase);
  const comision = tipo === "recarga" ? 1 : 0;
  const total = redondearCentavos(monto + comision);
  const nombre = tipo === "recarga"
    ? `Recarga $${monto.toFixed(2)}`
    : "Pago de servicio";

  agregarItemAlInicio({
    carrito_id: `servicio-${Date.now()}-${consecutivoLineaEspecial++}`,
    tipo_linea: "servicio_electronico",
    servicio_tipo: tipo,
    nombre,
    cantidad: 1,
    precio_unitario: total,
    precio_unitario_original: total,
    tipo_producto: tipo,
    unidad: "servicio",
    subtotal: total,
    monto_base: monto,
    comision,
    promocion_aplicada: false,
    texto_promocion: "",
    descuento_promocion: 0,
    es_retornable: 0,
    tipo_envase_id: null,
  });

  recalcularCarrito();
  renderCarrito();
  cerrarModalServicioElectronico();
  mostrarMensaje(`${nombre} agregado.`);
}

function agregarAlCarrito(producto) {
  const existente = carrito.find((item) => item.producto_id === producto.id);

  if (existente) {
    existente.cantidad += 1;
    existente.es_retornable = Number(producto.es_retornable || existente.es_retornable || 0);
    existente.tipo_envase_id = producto.tipo_envase_id
      ? Number(producto.tipo_envase_id)
      : existente.tipo_envase_id || null;
    moverItemAlInicio(existente);
  } else {
    const precio = Number(producto.precio_aplicable || producto.precio_global);

    agregarItemAlInicio({
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad: 1,
      precio_unitario: precio,
      precio_unitario_original: precio,
      tipo_producto: producto.tipo_producto,
      unidad: producto.unidad,
      subtotal: precio,
      promocion_aplicada: false,
      texto_promocion: "",
      descuento_promocion: 0,
      es_retornable: Number(producto.es_retornable || 0),
      tipo_envase_id: producto.tipo_envase_id ? Number(producto.tipo_envase_id) : null,
    });
  }

  recalcularCarrito();
  renderCarrito();
}

function agregarItemAlInicio(item) {
  carrito.unshift(item);
}

function moverItemAlInicio(item) {
  const index = carrito.indexOf(item);

  if (index <= 0) {
    return;
  }

  carrito.splice(index, 1);
  carrito.unshift(item);
}

function renderCarrito() {
  carritoTabla.innerHTML = "";

  carrito.forEach((item) => {
    const tr = document.createElement("tr");
    const itemKey = item.carrito_id || `producto-${item.producto_id}`;

    tr.innerHTML = `
<td class="p-3">
  <div class="font-semibold">${item.nombre}</div>
  ${
    item.promocion_aplicada
      ? `<div class="text-xs text-cyan-300 font-bold mt-1">
          Promo: ${item.texto_promocion}
        </div>`
      : ""
  }

    ${
    Number(item.es_retornable || 0) === 1
      ? `<div class="text-xs text-lime-300 font-bold mt-1">
          Retornable
        </div>`
      : ""
  }
  ${
    item.tipo_linea === "servicio_electronico"
      ? `<div class="text-xs text-cyan-300 font-bold mt-1">
          ${item.servicio_tipo === "recarga" ? `Comision: $${Number(item.comision || 0).toFixed(2)}` : "Servicio electronico"}
        </div>`
      : ""
  }
</td>

<td class="p-3">
  ${item.cantidad}
</td>

<td class="p-3">
  ${
    item.promocion_aplicada
      ? `
        <div class="line-through text-zinc-500">
          $${Number(item.precio_unitario_original).toFixed(2)}
        </div>
        <div class="text-cyan-300 font-bold">
          $${Number(item.precio_unitario).toFixed(2)}
        </div>
      `
      : `$${Number(item.precio_unitario).toFixed(2)}`
  }
</td>

<td class="p-3">
  <div class="font-bold ${item.promocion_aplicada ? "text-cyan-300" : "text-green-400"}">
    $${Number(item.subtotal).toFixed(2)}
  </div>

  ${
    item.promocion_aplicada
      ? `<div class="text-xs text-zinc-400">
          Ahorro: $${Number(item.descuento_promocion || 0).toFixed(2)}
        </div>`
      : ""
  }
</td>
 <td class="p-3 text-right whitespace-nowrap">
  <button
    onclick="quitarUno('${itemKey}')"
    class="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded-lg font-bold mr-2"
  >
    -1
  </button>

  <button
    onclick="eliminarItem('${itemKey}')"
    class="bg-red-500 hover:bg-red-400 text-black px-3 py-1 rounded-lg font-bold"
  >
    Quitar
  </button>
</td>
    `;

    carritoTabla.appendChild(tr);
  });

  const total = carrito.reduce((sum, item) => sum + item.subtotal, 0);
  const cantidad = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  totalVenta.textContent = `$${total.toFixed(2)}`;
  totalProductos.textContent = cantidad;

  calcularCambio();
}



function obtenerClaveCarrito(item) {
  return item.carrito_id || `producto-${item.producto_id}`;
}

function eliminarItem(itemKey) {
carrito = carrito.filter((item) => obtenerClaveCarrito(item) !== itemKey);
recalcularCarrito();
renderCarrito();
}

async function cobrarVenta() {
  if (ventaEnProceso) {
    return;
  }

  if (carrito.length === 0) {
    mostrarMensaje("No hay productos en la venta.");
    return;
  }

  const metodoPagoSeleccionado = metodoPago.value;
  const clienteFiadoSeleccionado = clienteFiado.value;

  if (
    metodoPagoSeleccionado === "fiado" &&
    (!clienteFiadoSeleccionado || clienteFiadoSeleccionado === "nuevo")
  ) {
    mostrarMensaje("Selecciona el cliente para fiado.");
    return;
  }

  const envasesVenta = await pedirEnvasesVenta();

  if (envasesVenta === null) {
    mostrarMensaje("Venta cancelada. Falta confirmar envases.");
    return;
  }

  const totalProductosVenta = obtenerTotalProductosVenta();
  const totalImportesEnvase = calcularTotalImportesEnvases(envasesVenta);
  let pagoMixto = null;

  if (metodoPago.value === "mixto") {
    pagoMixto = await pedirPagoMixto(totalProductosVenta, totalImportesEnvase);

    if (pagoMixto === null) {
      mostrarMensaje("Venta cancelada. Falta confirmar pago mixto.");
      return;
    }
  }

  const body = {
    tienda_id: tiendaId,
    usuario_id: usuarioId,
    metodo_pago: metodoPagoSeleccionado,

    cliente_fiado_id:
      metodoPagoSeleccionado === "fiado"
        ? Number(clienteFiadoSeleccionado)
        : null,

    productos: carrito
      .filter((item) => item.tipo_linea !== "servicio_electronico")
      .map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
      })),
    servicios: carrito
      .filter((item) => item.tipo_linea === "servicio_electronico")
      .map((item) => ({
        tipo: item.servicio_tipo,
        monto_base: item.monto_base,
      })),
    envases: envasesVenta,
    pago_mixto: pagoMixto,
  };

  try {
    ventaEnProceso = true;
    btnCobrar.disabled = true;
    btnCobrar.classList.add("opacity-60", "cursor-not-allowed");

    if (metodoPagoSeleccionado === "fiado") {
      const cliente = clientesFiado.find(
        (c) => Number(c.id) === Number(clienteFiadoSeleccionado),
      );

      if (cliente) {
        const deudaActual = Number(cliente.deuda_total || 0);
        const limite = Number(cliente.limite_credito || 0);
        const totalVenta = carrito.reduce(
          (total, item) => total + Number(item.subtotal || 0),
          0,
        );

        if (limite > 0 && deudaActual + totalVenta > limite) {
          const continuar = confirm(
            `ATENCIÓN: este fiado superará el límite del cliente.\n\n` +
              `Cliente: ${cliente.nombre_completo}\n` +
              `Deuda actual: $${deudaActual.toFixed(2)}\n` +
              `Venta actual: $${totalVenta.toFixed(2)}\n` +
              `Límite: $${limite.toFixed(2)}\n\n` +
              `¿Deseas aceptar y continuar?`,
          );

          if (!continuar) {
            return;
          }
        }
      }
    }
    const response = await fetch(`${API_URL}/ventas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar venta.");
      return;
    }

    mostrarMensaje(`Venta registrada. Total: $${data.total.toFixed(2)}`);

    carrito = [];
    reiniciarEstadoPagoVenta();
    renderCarrito();
    codigoInput.focus();
  } catch (error) {
    mostrarMensaje("Error al conectar con el servidor.");
  } finally {
    ventaEnProceso = false;
    btnCobrar.disabled = false;
    btnCobrar.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function reiniciarEstadoPagoVenta() {
  pagoCon.value = "";
  metodoPago.value = "efectivo";
  clienteFiado.value = "";
  grupoClienteFiado.classList.add("hidden");
  formNuevoDeudorVenta.classList.add("hidden");
  calcularCambio();
}

function redondearCentavos(monto) {
  return Math.round(Number(monto || 0) * 100) / 100;
}

function obtenerTotalProductosVenta() {
  return redondearCentavos(
    carrito.reduce((total, item) => total + Number(item.subtotal || 0), 0),
  );
}

function calcularTotalImportesEnvases(envases = []) {
  return redondearCentavos(
    envases.reduce((total, envase) => {
      if (envase.escenario !== "dejo_importe") {
        return total;
      }

      const tipoEnvase = obtenerTipoEnvaseVenta(envase.tipo_envase_id);
      return total + importesEnvases.calcularImporteEnvase(
        tipoEnvase,
        Number(envase.cantidad || 0),
      );
    }, 0),
  );
}

function obtenerMontosPagoMixto() {
  return {
    efectivo: redondearCentavos(pagoMixtoEfectivo?.value),
    transferencia: redondearCentavos(pagoMixtoTransferencia?.value),
    fiado: redondearCentavos(pagoMixtoFiado?.value),
  };
}

function actualizarResumenPagoMixto() {
  if (!modalPagoMixto) {
    return;
  }

  const { efectivo, transferencia, fiado } = obtenerMontosPagoMixto();
  const suma = redondearCentavos(efectivo + transferencia + fiado);
  const restante = redondearCentavos(totalPagoMixtoActual - suma);

  pagoMixtoRestante.textContent = `$${Math.abs(restante).toFixed(2)}`;
  pagoMixtoRestante.classList.toggle("text-red-300", restante < 0);
  pagoMixtoRestante.classList.toggle("text-green-400", restante >= 0);
  grupoPagoMixtoCliente.classList.toggle("hidden", fiado <= 0);

  if (fiado <= 0 && pagoMixtoCliente) {
    pagoMixtoCliente.value = "";
  }
}

function abrirModalPagoMixto(totalProductos, totalImportes) {
  totalPagoMixtoActual = redondearCentavos(totalProductos);
  pagoMixtoTotalProductos.textContent = `$${totalPagoMixtoActual.toFixed(2)}`;
  pagoMixtoTotalImportes.textContent = `$${redondearCentavos(totalImportes).toFixed(2)}`;
  pagoMixtoEfectivo.value = "";
  pagoMixtoTransferencia.value = "";
  pagoMixtoFiado.value = "";
  pagoMixtoCliente.value = "";
  pagoMixtoObservaciones.value = "";
  mensajePagoMixto.textContent = totalImportes > 0
    ? `El importe de envases ($${redondearCentavos(totalImportes).toFixed(2)}) se cobra aparte en efectivo o transferencia.`
    : "";
  actualizarResumenPagoMixto();

  modalPagoMixto.classList.remove("hidden");
  modalPagoMixto.classList.add("flex");
}

function cerrarModalPagoMixto() {
  modalPagoMixto.classList.add("hidden");
  modalPagoMixto.classList.remove("flex");
}

async function pedirPagoMixto(totalProductos, totalImportes) {
  await cargarClientesFiado();

  pagoMixtoCliente.innerHTML = `<option value="">Selecciona cliente...</option>`;
  clientesFiado.forEach((cliente) => {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = `${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}`;
    pagoMixtoCliente.appendChild(option);
  });

  abrirModalPagoMixto(totalProductos, totalImportes);

  return new Promise((resolve) => {
    resolverPagoMixto = resolve;
  });
}

function redondearAMedioPeso(monto) {
  return redondeoOperativo.redondearAMedioPeso(monto);
}

function esProductoAGranel(producto) {
  return redondeoOperativo.esProductoAGranel(producto);
}

function calcularSubtotalOperativo(producto, subtotalBase) {
  return redondeoOperativo.calcularSubtotalOperativo(producto, subtotalBase);
}

function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");

  window.location.href = "./login.html";
}

function calcularCambio() {
  const total = carrito.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0,
  );
  const pagado = Number(pagoCon.value || 0);

  if (!pagado || pagado <= 0) {
    cambioVenta.textContent = "$0.00";
    cambioVenta.className = "text-2xl font-bold text-yellow-300";
    return;
  }

  const cambio = pagado - total;

  cambioVenta.textContent = `$${cambio.toFixed(2)}`;

  if (cambio < 0) {
    cambioVenta.className = "text-2xl font-bold text-red-400";
  } else {
    cambioVenta.className = "text-2xl font-bold text-yellow-300";
  }
}
async function crearDeudorDesdeVenta() {
  const body = {
    nombre_completo: nuevoDeudorNombre.value.trim(),
    apodo: nuevoDeudorApodo.value.trim(),
    telefono: nuevoDeudorTelefono.value.trim(),
    limite_credito: Number(nuevoDeudorLimite.value) || 0,
  };

  if (!body.nombre_completo) {
    mostrarMensaje("El nombre completo del deudor es obligatorio.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/fiados/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al crear deudor.");
      return;
    }

    nuevoDeudorNombre.value = "";
    nuevoDeudorApodo.value = "";
    nuevoDeudorTelefono.value = "";
    nuevoDeudorLimite.value = "";
    formNuevoDeudorVenta.classList.add("hidden");

    await cargarClientesFiado();

    clienteFiado.value = data.id;

    mostrarMensaje("Deudor creado y seleccionado.");
  } catch (error) {
    mostrarMensaje("Error al crear deudor.");
  }
}

async function cargarClientesFiado() {
  const clienteSeleccionadoAntes = clienteFiado.value;

  try {
    const response = await fetch(`${API_URL}/fiados/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar clientes fiados.");
      return;
    }

    clientesFiado = data;

    clienteFiado.innerHTML = "";

    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.textContent = "Selecciona cliente...";
    clienteFiado.appendChild(optionDefault);

    clientesFiado.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente.id;
      option.textContent = `${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}`;
      clienteFiado.appendChild(option);
    });

    const optionNuevo = document.createElement("option");
    optionNuevo.value = "nuevo";
    optionNuevo.textContent = "+ Crear nuevo deudor";
    clienteFiado.appendChild(optionNuevo);

    const seleccionSigueDisponible = Array.from(clienteFiado.options).some(
      (option) => option.value === clienteSeleccionadoAntes,
    );

    if (seleccionSigueDisponible) {
      clienteFiado.value = clienteSeleccionadoAntes;
    }
  } catch (error) {
    console.error("ERROR CLIENTES FIADO:", error);
    mostrarMensaje("Error al cargar clientes fiados.");
  }
}

function quitarUno(itemKey) {
  const item = carrito.find(
    (item) => obtenerClaveCarrito(item) === itemKey
  );

  if (!item) return;

  if (item.tipo_linea === "servicio_electronico") {
    carrito = carrito.filter((item) => obtenerClaveCarrito(item) !== itemKey);
    renderCarrito();
    return;
  }

  if (item.cantidad > 1) {
    item.cantidad -= 1;
    item.subtotal = item.cantidad * Number(item.precio_unitario);
  } else {
    carrito = carrito.filter(
      (item) => obtenerClaveCarrito(item) !== itemKey
    );
  }

  recalcularCarrito();
  renderCarrito();
}


async function cargarPromocionesActivas() {
  try {
    const response = await fetch(`${API_URL}/promociones/activas`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      promocionesActivas = [];
      return;
    }

    promocionesActivas = data;
  } catch (error) {
    console.error("Error al cargar promociones activas:", error);
    promocionesActivas = [];
  }
}


function obtenerPromocionesProducto(productoId) {
  return promocionesActivas.filter(
    (promo) => Number(promo.producto_id) === Number(productoId)
  );
}

function calcularPrecioConPromocion(item) {
  const promociones = obtenerPromocionesProducto(item.producto_id);

  const cantidad = Number(item.cantidad || 0);
  const precioNormal = Number(item.precio_unitario_original || item.precio_unitario || 0);

  if (esProductoAGranel(item)) {
    return {
      subtotal: calcularSubtotalOperativo(item, cantidad * precioNormal),
      precioUnitarioFinal: precioNormal,
      promocionAplicada: false,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
      textoPromocion: "",
    };
  }

  if (!promociones || promociones.length === 0) {
    return {
      subtotal: cantidad * precioNormal,
      precioUnitarioFinal: precioNormal,
      promocionAplicada: false,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
      textoPromocion: "",
    };
  }

  const promocionesValidas = promociones
    .map((promo) => ({
      id: promo.id,
      cantidad: Number(promo.cantidad_requerida),
      precioCentavos: Math.round(Number(promo.precio_promocion) * 100),
      precioPromocion: Number(promo.precio_promocion),
    }))
    .filter((promo) =>
      Number.isInteger(promo.cantidad) &&
      promo.cantidad >= 2 &&
      promo.precioCentavos > 0
    )
    .sort((a, b) => {
      const precioUnidadA = a.precioCentavos / a.cantidad;
      const precioUnidadB = b.precioCentavos / b.cantidad;

      if (precioUnidadA !== precioUnidadB) {
        return precioUnidadA - precioUnidadB;
      }

      return b.cantidad - a.cantidad;
    });

  if (
    !Number.isInteger(cantidad) ||
    cantidad <= 0 ||
    promocionesValidas.length === 0
  ) {
    return {
      subtotal: cantidad * precioNormal,
      precioUnitarioFinal: precioNormal,
      promocionAplicada: false,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
      textoPromocion: "",
    };
  }

  const precioNormalCentavos = Math.round(precioNormal * 100);
  const dp = Array.from({ length: cantidad + 1 }, () => ({
    total: 0,
    conteoPromos: {},
    cantidadPromo: 0,
  }));

  for (let i = 1; i <= cantidad; i += 1) {
    let mejor = {
      total: dp[i - 1].total + precioNormalCentavos,
      conteoPromos: { ...dp[i - 1].conteoPromos },
      cantidadPromo: dp[i - 1].cantidadPromo,
    };

    promocionesValidas.forEach((promo) => {
      if (i < promo.cantidad) return;

      const anterior = dp[i - promo.cantidad];
      const candidato = {
        total: anterior.total + promo.precioCentavos,
        conteoPromos: {
          ...anterior.conteoPromos,
          [promo.id]: (anterior.conteoPromos[promo.id] || 0) + 1,
        },
        cantidadPromo: anterior.cantidadPromo + promo.cantidad,
      };

      if (candidato.total < mejor.total) {
        mejor = candidato;
      }
    });

    dp[i] = mejor;
  }

  const mejorResultado = dp[cantidad];
  const subtotalFinal = mejorResultado.total / 100;
  const subtotalOriginal = cantidad * precioNormal;
  const descuentoPromocion = subtotalOriginal - subtotalFinal;

  if (descuentoPromocion <= 0 || mejorResultado.cantidadPromo <= 0) {
    return {
      subtotal: cantidad * precioNormal,
      precioUnitarioFinal: precioNormal,
      promocionAplicada: false,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
      textoPromocion: "",
    };
  }

  const textoPromocion = promocionesValidas
    .filter((promo) => mejorResultado.conteoPromos[promo.id] > 0)
    .map((promo) => {
      const veces = mejorResultado.conteoPromos[promo.id];
      const textoBase = `${promo.cantidad} por $${promo.precioPromocion.toFixed(2)}`;
      return veces > 1 ? `${textoBase} x${veces}` : textoBase;
    })
    .join(" + ");

  return {
    subtotal: subtotalFinal,
    precioUnitarioFinal: subtotalFinal / cantidad,
    promocionAplicada: true,
    cantidadPromocionAplicada: mejorResultado.cantidadPromo,
    descuentoPromocion,
    textoPromocion,
  };
}

function recalcularCarrito() {
  carrito = carrito.map((item) => {
    if (item.tipo_linea === "servicio_electronico") {
      return item;
    }

    const resultado = calcularPrecioConPromocion(item);

    return {
      ...item,
      precio_unitario: resultado.precioUnitarioFinal,
      subtotal: resultado.subtotal,
      promocion_aplicada: resultado.promocionAplicada,
      texto_promocion: resultado.textoPromocion,
      cantidad_promocion_aplicada: resultado.cantidadPromocionAplicada,
      descuento_promocion: resultado.descuentoPromocion,
    };
  });
}


function obtenerItemsRetornables() {
  return carrito.filter(
    (item) => Number(item.es_retornable || 0) === 1 && item.tipo_envase_id
  );
}

function obtenerClienteFiadoSeleccionado() {
  if (metodoPago.value !== "fiado") {
    return null;
  }

  return clientesFiado.find(
    (cliente) => Number(cliente.id) === Number(clienteFiado.value)
  );
}

async function pedirEnvasesVenta() {
  const retornables = obtenerItemsRetornables();

  if (retornables.length === 0) {
    return [];
  }

  await Promise.all([cargarClientesFiado(), cargarTiposEnvaseVenta()]);

  listaEnvasesVenta.innerHTML = "";
  actualizarResumenImportesEnvases();

  const clienteVentaFiada = obtenerClienteFiadoSeleccionado();

  const opcionesClientes = clientesFiado
    .map(
      (cliente) =>
        `<option value="${cliente.id}" ${Number(cliente.id) === Number(clienteVentaFiada?.id) ? "selected" : ""}>${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}</option>`
    )
    .join("");

  retornables.forEach((item) => {
    const div = document.createElement("div");
    div.className = "bg-zinc-950 border border-zinc-800 rounded-2xl p-4";

    div.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 class="font-black text-lg">${item.nombre}</h3>
          <p class="text-sm text-zinc-500">
            Cantidad: ${item.cantidad} envase(s)
          </p>
        </div>

        <div>
          <label class="block text-sm text-zinc-400 mb-2">
            Escenario
          </label>

          <select
            class="escenario-envase w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
            data-producto-id="${item.producto_id}"
          >
            <option value="trajo_envase">Trajo envase</option>
            <option value="dejo_importe">Dejó importe</option>
            <option value="envase_prestado">Envase prestado</option>
          </select>
        </div>

        <div class="cliente-envase-contenedor md:col-span-2 hidden" data-producto-id="${item.producto_id}">
          <label class="block text-sm text-zinc-400 mb-2">
            Cliente
          </label>

          <select
            class="cliente-envase-select w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
            data-producto-id="${item.producto_id}"
          >
            <option value="">Selecciona cliente...</option>
            ${opcionesClientes}
            <option value="otro">Otro / crear cliente</option>
          </select>
        </div>

        <div class="cliente-envase-otro-contenedor md:col-span-2 hidden" data-producto-id="${item.producto_id}">
          <label class="block text-sm text-zinc-400 mb-2">
            Nombre del cliente
          </label>

          <input
            class="cliente-envase-otro w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
            data-producto-id="${item.producto_id}"
            placeholder="Nombre del cliente..."
          />
        </div>
      </div>
    `;

    listaEnvasesVenta.appendChild(div);
  });

  listaEnvasesVenta.querySelectorAll(".escenario-envase").forEach((select) => {
    select.addEventListener("change", () => {
      const productoId = select.dataset.productoId;

      const contenedorCliente = listaEnvasesVenta.querySelector(
        `.cliente-envase-contenedor[data-producto-id="${productoId}"]`
      );

      const contenedorOtro = listaEnvasesVenta.querySelector(
        `.cliente-envase-otro-contenedor[data-producto-id="${productoId}"]`
      );

      const selectCliente = listaEnvasesVenta.querySelector(
        `.cliente-envase-select[data-producto-id="${productoId}"]`
      );

      if (select.value === "trajo_envase") {
        contenedorCliente.classList.add("hidden");
        contenedorOtro.classList.add("hidden");
        selectCliente.value = "";
      } else {
        contenedorCliente.classList.remove("hidden");
      }

      actualizarResumenImportesEnvases();
    });
  });

  listaEnvasesVenta.querySelectorAll(".cliente-envase-select").forEach((select) => {
    select.addEventListener("change", () => {
      const productoId = select.dataset.productoId;
      const contenedorOtro = listaEnvasesVenta.querySelector(
        `.cliente-envase-otro-contenedor[data-producto-id="${productoId}"]`
      );

      if (select.value === "otro") {
        contenedorOtro.classList.remove("hidden");
      } else {
        contenedorOtro.classList.add("hidden");
      }
    });
  });

  abrirModalEnvasesVenta();

  return new Promise((resolve) => {
    resolverEnvasesVenta = resolve;
  });
}

function abrirModalEnvasesVenta() {
  overflowBodyAntesModalEnvases = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  modalEnvasesVenta.classList.remove("hidden");
  modalEnvasesVenta.classList.add("flex");
}

function cerrarModalEnvasesVenta() {
  document.body.style.overflow = overflowBodyAntesModalEnvases;
  modalEnvasesVenta.classList.add("hidden");
  modalEnvasesVenta.classList.remove("flex");
}

async function cargarTiposEnvaseVenta() {
  if (tiposEnvaseVenta.length > 0) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/importes/tipos-envase`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar tipos de envase.");
      tiposEnvaseVenta = [];
      return;
    }

    tiposEnvaseVenta = data;
  } catch (error) {
    console.error("Error al cargar tipos de envase:", error);
    tiposEnvaseVenta = [];
    mostrarMensaje("Error al cargar tipos de envase.");
  }
}

function obtenerTipoEnvaseVenta(tipoEnvaseId) {
  return tiposEnvaseVenta.find(
    (tipo) => Number(tipo.id) === Number(tipoEnvaseId)
  );
}

function actualizarResumenImportesEnvases() {
  if (!resumenImportesEnvasesVenta) {
    return;
  }

  const retornables = obtenerItemsRetornables();
  const totalProductos = carrito.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0
  );

  const totalImportes = retornables.reduce((sum, item) => {
    const selectEscenario = listaEnvasesVenta.querySelector(
      `.escenario-envase[data-producto-id="${item.producto_id}"]`
    );

    if (selectEscenario?.value !== "dejo_importe") {
      return sum;
    }

    const tipoEnvase = obtenerTipoEnvaseVenta(item.tipo_envase_id);
    return sum + importesEnvases.calcularImporteEnvase(
      tipoEnvase,
      Number(item.cantidad || 0)
    );
  }, 0);

  if (totalImportes <= 0) {
    resumenImportesEnvasesVenta.classList.add("hidden");
    return;
  }

  resumenEnvasesProductos.textContent = `$${totalProductos.toFixed(2)}`;
  resumenEnvasesImportes.textContent = `+$${totalImportes.toFixed(2)}`;
  resumenEnvasesTotalCobrar.textContent = `$${(totalProductos + totalImportes).toFixed(2)}`;
  resumenImportesEnvasesVenta.classList.remove("hidden");
}

btnCancelarEnvasesVenta?.addEventListener("click", () => {
  cerrarModalEnvasesVenta();

  if (resolverEnvasesVenta) {
    resolverEnvasesVenta(null);
    resolverEnvasesVenta = null;
  }
});


pagoMixtoEfectivo?.addEventListener("input", actualizarResumenPagoMixto);
pagoMixtoTransferencia?.addEventListener("input", actualizarResumenPagoMixto);
pagoMixtoFiado?.addEventListener("input", actualizarResumenPagoMixto);

btnCancelarPagoMixto?.addEventListener("click", () => {
  cerrarModalPagoMixto();

  if (resolverPagoMixto) {
    resolverPagoMixto(null);
    resolverPagoMixto = null;
  }
});

btnConfirmarPagoMixto?.addEventListener("click", () => {
  const { efectivo, transferencia, fiado } = obtenerMontosPagoMixto();
  const suma = redondearCentavos(efectivo + transferencia + fiado);

  if (efectivo < 0 || transferencia < 0 || fiado < 0) {
    mensajePagoMixto.textContent = "Los montos no pueden ser negativos.";
    return;
  }

  if (Math.abs(suma - totalPagoMixtoActual) > 0.01) {
    mensajePagoMixto.textContent = `El desglose debe sumar $${totalPagoMixtoActual.toFixed(2)} en productos.`;
    actualizarResumenPagoMixto();
    return;
  }

  if (fiado > 0 && !pagoMixtoCliente.value) {
    mensajePagoMixto.textContent = "Selecciona cliente para la parte fiada.";
    return;
  }

  cerrarModalPagoMixto();

  if (resolverPagoMixto) {
    resolverPagoMixto({
      efectivo,
      transferencia,
      fiado,
      cliente_fiado_id: fiado > 0 ? Number(pagoMixtoCliente.value) : null,
      observaciones: pagoMixtoObservaciones.value.trim(),
    });
    resolverPagoMixto = null;
  }
});


btnConfirmarEnvasesVenta?.addEventListener("click", () => {
  const retornables = obtenerItemsRetornables();
  const envases = [];

  for (const item of retornables) {
    const selectEscenario = listaEnvasesVenta.querySelector(
      `.escenario-envase[data-producto-id="${item.producto_id}"]`
    );

    const selectCliente = listaEnvasesVenta.querySelector(
      `.cliente-envase-select[data-producto-id="${item.producto_id}"]`
    );

    const inputClienteOtro = listaEnvasesVenta.querySelector(
      `.cliente-envase-otro[data-producto-id="${item.producto_id}"]`
    );

    const escenario = selectEscenario?.value;

    if (!escenario) {
      mostrarMensaje(`Selecciona escenario para ${item.nombre}.`);
      return;
    }

    let clienteFiadoId = null;
    let clienteNombre = "Cliente mostrador";

    if (escenario !== "trajo_envase") {
      const clienteSeleccionado = selectCliente?.value || "";
      const clienteOtro = inputClienteOtro?.value.trim() || "";

      if (!clienteSeleccionado) {
        mostrarMensaje(`Selecciona cliente para ${item.nombre}.`);
        return;
      }

      if (clienteSeleccionado === "otro") {
        if (!clienteOtro) {
          mostrarMensaje(`Escribe el nombre del cliente para ${item.nombre}.`);
          return;
        }

        clienteNombre = clienteOtro;
      } else {
        const cliente = clientesFiado.find(
          (c) => Number(c.id) === Number(clienteSeleccionado)
        );

        if (!cliente) {
          mostrarMensaje(`Cliente inválido para ${item.nombre}.`);
          return;
        }

        clienteFiadoId = Number(cliente.id);
        clienteNombre = cliente.nombre_completo;
      }
    }

    envases.push({
      producto_id: item.producto_id,
      producto_nombre: item.nombre,
      tipo_envase_id: item.tipo_envase_id,
      escenario,
      cantidad: Number(item.cantidad),
      cliente: clienteNombre,
      cliente_fiado_id: clienteFiadoId,
    });
  }

  cerrarModalEnvasesVenta();

  if (resolverEnvasesVenta) {
    resolverEnvasesVenta(envases);
    resolverEnvasesVenta = null;
  }
});
