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
const modalEnvasesVenta = document.getElementById("modalEnvasesVenta");
const listaEnvasesVenta = document.getElementById("listaEnvasesVenta");
const btnConfirmarEnvasesVenta = document.getElementById("btnConfirmarEnvasesVenta");
const btnCancelarEnvasesVenta = document.getElementById("btnCancelarEnvasesVenta");
const tituloModalManual = document.getElementById("tituloModalManual");
const labelCantidadManual = document.getElementById("labelCantidadManual");

let clientesFiado = [];
let carrito = [];
let modoModalProducto = "peso";
let promocionesActivas = [];
let resolverEnvasesVenta = null;
let ventaEnProceso = false;
const redondeoOperativo = window.RedondeoOperativo;

const usuarioId = usuario.id;

usuarioNombre.textContent = usuario.nombre;
usuarioRol.textContent = `${usuario.rol} • ${usuario.tienda}`;

btnLogout.addEventListener("click", cerrarSesion);

codigoInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;

  const codigo = codigoInput.value.trim();

  if (!codigo) return;

  await buscarProductoPorCodigo(codigo);

  codigoInput.value = "";
  codigoInput.focus();
});

btnCobrar.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  await cobrarVenta();
});

btnLimpiar.addEventListener("click", (event) => {
  event.preventDefault();
  carrito = [];
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

btnGuardarNuevoDeudorVenta.addEventListener("click", crearDeudorDesdeVenta);
cargarPromocionesActivas();

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
      mostrarMensaje(data.error || "Producto no encontrado.");
      return;
    }

    agregarAlCarrito(data);
    mostrarMensaje(`${data.nombre} agregado.`);
  } catch (error) {
    console.error("Error real al buscar producto:", error);
    mostrarMensaje("Error al buscar producto.");
  }
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
  if (modoModalProducto === "suelto" && !Number.isInteger(cantidad)) {
  mostrarMensaje("La cantidad de producto suelto debe ser entera.");
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

carrito.push({
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

function agregarAlCarrito(producto) {
  const existente = carrito.find((item) => item.producto_id === producto.id);

  if (existente) {
    existente.cantidad += 1;
    existente.es_retornable = Number(producto.es_retornable || existente.es_retornable || 0);
    existente.tipo_envase_id = producto.tipo_envase_id
      ? Number(producto.tipo_envase_id)
      : existente.tipo_envase_id || null;
  } else {
    const precio = Number(producto.precio_aplicable || producto.precio_global);

    carrito.push({
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

function renderCarrito() {
  carritoTabla.innerHTML = "";

  carrito.forEach((item) => {
    const tr = document.createElement("tr");

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
    onclick="quitarUno(${item.producto_id})"
    class="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded-lg font-bold mr-2"
  >
    -1
  </button>

  <button
    onclick="eliminarItem(${item.producto_id})"
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



function eliminarItem(productoId) {
carrito = carrito.filter((item) => item.producto_id !== productoId);
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

    const envasesVenta = await pedirEnvasesVenta();

  if (envasesVenta === null) {
    mostrarMensaje("Venta cancelada. Falta confirmar envases.");
    return;
  }

  const body = {
    tienda_id: tiendaId,
    usuario_id: usuarioId,
    metodo_pago: metodoPago.value,

    cliente_fiado_id:
      metodoPago.value === "fiado" ? Number(clienteFiado.value) : null,

    productos: carrito.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    })),
      envases: envasesVenta,
  };

  try {
    ventaEnProceso = true;
    btnCobrar.disabled = true;
    btnCobrar.classList.add("opacity-60", "cursor-not-allowed");

    if (metodoPago.value === "fiado" && !clienteFiado.value) {
      mostrarMensaje("Selecciona el cliente para fiado.");
      return;
    }
    if (metodoPago.value === "fiado") {
      const cliente = clientesFiado.find(
        (c) => Number(c.id) === Number(clienteFiado.value),
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
async function cargarClientesFiado() {
  try {
    const response = await fetch(`${API_URL}/fiados/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    clientesFiado = await response.json();

    clienteFiado.innerHTML = `<option value="">Selecciona cliente...</option>`;

    clientesFiado.forEach((cliente) => {
      const option = document.createElement("option");

      option.value = cliente.id;
      option.textContent = `${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}`;

      clienteFiado.appendChild(option);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar clientes fiados.");
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
  } catch (error) {
    console.error("ERROR CLIENTES FIADO:", error);
    mostrarMensaje("Error al cargar clientes fiados.");
  }
}

function quitarUno(productoId) {
  const item = carrito.find(
    (item) => Number(item.producto_id) === Number(productoId)
  );

  if (!item) return;

  if (item.cantidad > 1) {
    item.cantidad -= 1;
    item.subtotal = item.cantidad * Number(item.precio_unitario);
  } else {
    carrito = carrito.filter(
      (item) => Number(item.producto_id) !== Number(productoId)
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


function obtenerPromocionProducto(productoId) {
  return promocionesActivas.find(
    (promo) => Number(promo.producto_id) === Number(productoId)
  );
}

function calcularPrecioConPromocion(item) {
  const promocion = obtenerPromocionProducto(item.producto_id);

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

  if (!promocion) {
    return {
      subtotal: cantidad * precioNormal,
      precioUnitarioFinal: precioNormal,
      promocionAplicada: false,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
      textoPromocion: "",
    };
  }

  const cantidadRequerida = Number(promocion.cantidad_requerida);
  const precioPromocion = Number(promocion.precio_promocion);

  if (
    !Number.isInteger(cantidad) ||
    cantidad < cantidadRequerida ||
    cantidadRequerida < 2 ||
    precioPromocion <= 0
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

  const gruposPromo = Math.floor(cantidad / cantidadRequerida);
  const cantidadConPromo = gruposPromo * cantidadRequerida;
  const cantidadNormal = cantidad - cantidadConPromo;

  const subtotalPromo = gruposPromo * precioPromocion;
  const subtotalNormal = cantidadNormal * precioNormal;

  const subtotalFinal = subtotalPromo + subtotalNormal;
  const subtotalOriginal = cantidad * precioNormal;
  const descuentoPromocion = subtotalOriginal - subtotalFinal;

  return {
    subtotal: subtotalFinal,
    precioUnitarioFinal: subtotalFinal / cantidad,
    promocionAplicada: true,
    cantidadPromocionAplicada: cantidadConPromo,
    descuentoPromocion,
    textoPromocion: `${cantidadRequerida} por $${precioPromocion.toFixed(2)}`,
  };
}

function recalcularCarrito() {
  carrito = carrito.map((item) => {
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

  await cargarClientesFiado();

  listaEnvasesVenta.innerHTML = "";

  const opcionesClientes = clientesFiado
    .map(
      (cliente) =>
        `<option value="${cliente.id}">${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}</option>`
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

  modalEnvasesVenta.classList.remove("hidden");
  modalEnvasesVenta.classList.add("flex");

  return new Promise((resolve) => {
    resolverEnvasesVenta = resolve;
  });
}
btnCancelarEnvasesVenta?.addEventListener("click", () => {
  modalEnvasesVenta.classList.add("hidden");
  modalEnvasesVenta.classList.remove("flex");

  if (resolverEnvasesVenta) {
    resolverEnvasesVenta(null);
    resolverEnvasesVenta = null;
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

  modalEnvasesVenta.classList.add("hidden");
  modalEnvasesVenta.classList.remove("flex");

  if (resolverEnvasesVenta) {
    resolverEnvasesVenta(envases);
    resolverEnvasesVenta = null;
  }
});
