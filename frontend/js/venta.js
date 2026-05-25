document.addEventListener("submit", (event) => {
  event.preventDefault();
  event.stopPropagation();
  console.log("Submit bloqueado");
});

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId =
  Number(localStorage.getItem("tienda_id"));

const tiendaNombre =
  localStorage.getItem("tienda_nombre");

if (!tiendaId) {
  window.location.href =
    "./config-terminal.html";
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
const btnGuardarNuevoDeudorVenta = document.getElementById("btnGuardarNuevoDeudorVenta");
const nuevoDeudorNombre = document.getElementById("nuevoDeudorNombre");
const nuevoDeudorApodo = document.getElementById("nuevoDeudorApodo");
const nuevoDeudorTelefono = document.getElementById("nuevoDeudorTelefono");
const nuevoDeudorLimite = document.getElementById("nuevoDeudorLimite");
const btnProductoSuelto = document.getElementById("btnProductoSuelto");


let clientesFiado = [];
let carrito = [];
let modoModalProducto = "peso";

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
  modalManual.classList.remove("hidden");
  modalManual.classList.add("flex");
  manualCantidad.placeholder = "Ejemplo: 1 pieza";

  await cargarProductosManuales("suelto");
});



btnGuardarNuevoDeudorVenta.addEventListener("click", crearDeudorDesdeVenta);

async function buscarProductoPorCodigo(codigo) {
  try {
    const response = await fetch(
      `${API_URL}/productos/codigo/${codigo}?tienda_id=${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
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

  if (modoModalProducto === "peso") {
    cantidad = cantidad / 1000;
  }

  const subtotal =
    modoModalProducto === "peso"
      ? redondearAMedioPeso(cantidad * precio)
      : cantidad * precio;

  carrito.push({
    producto_id,
    nombre,
    cantidad,
    precio_unitario: precio,
    subtotal,
  });

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
    existente.subtotal = existente.cantidad * existente.precio_unitario;
  } else {
    carrito.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad: 1,
      precio_unitario: producto.precio_aplicable || producto.precio_global,
      subtotal: producto.precio_aplicable || producto.precio_global,
    });
  }

  renderCarrito();
}

function renderCarrito() {
  carritoTabla.innerHTML = "";

  carrito.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3">${item.nombre}</td>
      <td class="p-3">${item.cantidad}</td>
      <td class="p-3">$${item.precio_unitario.toFixed(2)}</td>
      <td class="p-3">$${item.subtotal.toFixed(2)}</td>
      <td class="p-3 text-right">
        <button class="text-red-400 hover:text-red-300" onclick="eliminarItem(${item.producto_id})">
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
  renderCarrito();
}

async function cobrarVenta() {
  if (carrito.length === 0) {
    mostrarMensaje("No hay productos en la venta.");
    return;
  }

const body = {
  tienda_id: tiendaId,
  usuario_id: usuarioId,
  metodo_pago: metodoPago.value,

  cliente_fiado_id:
    metodoPago.value === "fiado"
      ? Number(clienteFiado.value)
      : null,

  productos: carrito.map((item) => ({
    producto_id: item.producto_id,
    cantidad: item.cantidad,
  })),
};

  try {
    if (metodoPago.value === "fiado" && !clienteFiado.value) {
  mostrarMensaje("Selecciona el cliente para fiado.");
  return;
}
if (metodoPago.value === "fiado") {
  const cliente = clientesFiado.find(
    (c) => Number(c.id) === Number(clienteFiado.value)
  );

  if (cliente) {
    const deudaActual = Number(cliente.deuda_total || 0);
    const limite = Number(cliente.limite_credito || 0);
    const totalVenta = carrito.reduce(
      (total, item) => total + Number(item.subtotal || 0),
      0
    );

    if (limite > 0 && deudaActual + totalVenta > limite) {
      const continuar = confirm(
        `ATENCIÓN: este fiado superará el límite del cliente.\n\n` +
        `Cliente: ${cliente.nombre_completo}\n` +
        `Deuda actual: $${deudaActual.toFixed(2)}\n` +
        `Venta actual: $${totalVenta.toFixed(2)}\n` +
        `Límite: $${limite.toFixed(2)}\n\n` +
        `¿Deseas aceptar y continuar?`
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
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function redondearAMedioPeso(monto) {
  return Math.round(monto * 2) / 2;
}

function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");

  window.location.href = "./login.html";
}

function calcularCambio() {
  const total = carrito.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
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
      option.textContent =
        `${cliente.nombre_completo} - debe $${Number(cliente.deuda_total || 0).toFixed(2)}`;

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