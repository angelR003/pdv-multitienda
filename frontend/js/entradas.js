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
const cantidad = document.getElementById("cantidad");
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
  } else {
    cantidad.placeholder = "Cantidad EN PIEZAS. Ejemplo: 12";
    cantidad.title = "Este producto se registra por piezas.";
  }
}

async function registrarEntrada() {
  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  let cantidadFinal = Number(cantidad.value);

  if (!cantidadFinal || cantidadFinal <= 0) {
    mostrarMensaje("La cantidad es obligatoria.");
    return;
  }

  if (productoSeleccionado.unidad === "kg") {
    cantidadFinal = cantidadFinal / 1000;
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
}

const buscarProductoEntrada = document.getElementById("buscarProductoEntrada");

buscarProductoEntrada?.addEventListener("input", () => {
  const texto = buscarProductoEntrada.value.toLowerCase().trim();

  const filtrados = productos.filter((p) =>
    String(p.nombre || "").toLowerCase().includes(texto) ||
    String(p.codigo_barras || "").toLowerCase().includes(texto) ||
    String(p.categoria || "").toLowerCase().includes(texto) ||
    String(p.marca || "").toLowerCase().includes(texto)
  );

  renderSelectProductos(filtrados);
});