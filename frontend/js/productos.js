const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const esAdmin = usuario.rol === "administrador";

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const tipoProducto = document.getElementById("tipoProducto");
const codigoBarras = document.getElementById("codigoBarras");
const nombre = document.getElementById("nombre");
const categoria = document.getElementById("categoria");
const marca = document.getElementById("marca");
const presentacion = document.getElementById("presentacion");
const unidad = document.getElementById("unidad");
const precio = document.getElementById("precio");
const costoCompra = document.getElementById("costoCompra");
const requiereCaducidad = document.getElementById("requiereCaducidad");
const btnGuardar = document.getElementById("btnGuardar");
const mensaje = document.getElementById("mensaje");
const tablaProductos = document.getElementById("tablaProductos");
const esDerivado = document.getElementById("esDerivado");
const grupoDerivado = document.getElementById("grupoDerivado");
const productoPadre = document.getElementById("productoPadre");
const unidadesPorPadre = document.getElementById("unidadesPorPadre");
const esRetornable = document.getElementById("esRetornable");
const grupoRetornable = document.getElementById("grupoRetornable");
const tipoEnvaseRetornable = document.getElementById("tipoEnvaseRetornable");


let productoEditandoId = null;
let productos = [];
let tiposEnvase = [];

btnGuardar.addEventListener("click", async () => {
  await guardarProducto();
});


cargarTiposEnvase();
cargarProductos();

esRetornable.addEventListener("change", () => {
  if (esRetornable.checked) {
    grupoRetornable.classList.remove("hidden");
  } else {
    grupoRetornable.classList.add("hidden");
    tipoEnvaseRetornable.value = "";
  }
});

esDerivado.addEventListener("change", () => {
  if (esDerivado.checked) {
    grupoDerivado.classList.remove("hidden");
    cargarProductosPadre();
  } else {
    grupoDerivado.classList.add("hidden");
    productoPadre.value = "";
    unidadesPorPadre.value = "";
  }
});

async function guardarProducto() {
  const body = {
    tipo_producto: tipoProducto.value,
    codigo_barras: codigoBarras.value.trim() || null,
    nombre: nombre.value.trim(),
    categoria: categoria.value,
    marca: marca.value.trim(),
    presentacion: presentacion.value.trim(),
    unidad: unidad.value.trim(),
    precio_global: Number(precio.value),
    costo_compra: Number(costoCompra.value),
    requiere_caducidad: requiereCaducidad.checked,
    es_derivado: esDerivado.checked ? 1 : 0,
    producto_padre_id: esDerivado.checked ? Number(productoPadre.value) : null,
    factor_conversion:
  esDerivado.checked
    ? 1 / Number(unidadesPorPadre.value)
    : 1,
    es_retornable: esRetornable.checked ? 1 : 0,
    tipo_envase_id: esRetornable.checked ? Number(tipoEnvaseRetornable.value) : null,
  };

  if (!body.nombre) {
    mostrarMensaje("El nombre es obligatorio.");
    return;
  }

  if (!body.unidad) {
    mostrarMensaje("La unidad es obligatoria.");
    return;
  }

  if (!body.precio_global || body.precio_global <= 0) {
    mostrarMensaje("El precio de venta debe ser mayor a 0.");
    return;
  }

  if (body.costo_compra < 0) {
    mostrarMensaje("El costo de compra no puede ser negativo.");
    return;
  }

  if (body.costo_compra > body.precio_global) {
    mostrarMensaje("El costo de compra no puede ser mayor al precio de venta.");
    return;
  }

  if (body.tipo_producto === "codigo_barras" && !body.codigo_barras) {
    mostrarMensaje(
      "El código de barras es obligatorio para productos con código.",
    );
    return;
  }

  if (esDerivado.checked) {
  if (!productoPadre.value) {
    mostrarMensaje("Selecciona el producto padre.");
    return;
  }

  if (!unidadesPorPadre.value || Number(unidadesPorPadre.value) <= 0) {
    mostrarMensaje("Indica cuántas unidades sueltas trae el paquete.");
    return;
  }
}

  if (esRetornable.checked && !tipoEnvaseRetornable.value) {
    mostrarMensaje("Selecciona el tipo de envase del producto retornable.");
    return;
  }

  try {
    const url = productoEditandoId
      ? `${API_URL}/productos/${productoEditandoId}`
      : `${API_URL}/productos`;

    const method = productoEditandoId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al guardar.");
      return;
    }

    mostrarMensaje(
      productoEditandoId
        ? "Producto actualizado correctamente."
        : "Producto creado correctamente.",
    );
    limpiarFormulario();
    productoEditandoId = null;

    btnGuardar.textContent = "Guardar producto";

    cargarProductos();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function limpiarFormulario() {
  codigoBarras.value = "";
  nombre.value = "";
  categoria.value = "";
  marca.value = "";
  presentacion.value = "";
  unidad.value = "pieza";
  precio.value = "";
  costoCompra.value = "";
  requiereCaducidad.checked = false;
  esRetornable.checked = false;
  tipoEnvaseRetornable.value = "";
  grupoRetornable.classList.add("hidden");
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

async function cargarProductos() {
  try {
    const response = await fetch(`${API_URL}/productos/admin`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      productos = [];
      renderProductos(productos);
      mostrarMensaje(data.error || "Error al cargar productos.");
      return;
    }

    if (!Array.isArray(data)) {
      productos = [];
      renderProductos(productos);
      mostrarMensaje("La respuesta de productos no es valida.");
      return;
    }

    productos = data;
    renderProductos(productos);
  } catch (error) {
    mostrarMensaje("Error al cargar productos.");
  }
}

function renderProductos(lista) {
  tablaProductos.innerHTML = "";

  if (!lista.length) {
    tablaProductos.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-zinc-500">
          No hay productos registrados.
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach((producto) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3">
        <div class="font-semibold">${producto.nombre}</div>
        <div class="text-xs text-zinc-500">
          ${producto.codigo_barras || "Sin código"}
        </div>
      </td>

      <td class="p-3 text-zinc-300">${producto.tipo_producto}</td>

      <td class="p-3 text-green-400 font-bold">
        $${Number(producto.precio_global).toFixed(2)}
      </td>

      <td class="p-3 text-zinc-300">
        $${Number(producto.costo_compra).toFixed(2)}
      </td>

      <td class="p-3 text-zinc-300">${producto.unidad}</td>

      <td>
        ${
          producto.activo
            ? `
              <button class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold mr-2" onclick="editarProducto(${producto.id})">
                Editar
              </button>
              <button class="bg-red-500 hover:bg-red-400 text-black px-4 py-2 rounded-xl font-bold" onclick="desactivarProducto(${producto.id})">
                Desactivar
              </button>
            `
            : `
              <button class="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl font-bold" onclick="activarProducto(${producto.id})">
                Activar
              </button>
            `
        }
      </td>
    `;

    tablaProductos.appendChild(tr);
  });
}

async function editarProducto(id) {
  try {
    const response = await fetch(`${API_URL}/productos/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const producto = await response.json();

    productoEditandoId = producto.id;

    tipoProducto.value = producto.tipo_producto;
    codigoBarras.value = producto.codigo_barras || "";
    nombre.value = producto.nombre;
    categoria.value = producto.categoria;
    marca.value = producto.marca;
    presentacion.value = producto.presentacion;
    unidad.value = producto.unidad;
    precio.value = producto.precio_global;
    costoCompra.value = producto.costo_compra;
    requiereCaducidad.checked = producto.requiere_caducidad === 1;

    esRetornable.checked = Number(producto.es_retornable || 0) === 1;
    tipoEnvaseRetornable.value = producto.tipo_envase_id || "";

    if (esRetornable.checked) {
      grupoRetornable.classList.remove("hidden");
    } else {
      grupoRetornable.classList.add("hidden");
    }

    btnGuardar.textContent = "Actualizar producto";

    mostrarMensaje(`Editando: ${producto.nombre}`);
  } catch (error) {
    mostrarMensaje("Error al cargar producto.");
  }
}
async function desactivarProducto(id) {
  const confirmar = confirm("¿Seguro que quieres desactivar este producto?");

  if (!confirmar) return;

  try {
    const response = await fetch(`${API_URL}/productos/${id}/desactivar`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al desactivar producto.");
      return;
    }

    mostrarMensaje("Producto desactivado correctamente.");
    cargarProductos();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function activarProducto(id) {
  try {
    const response = await fetch(`${API_URL}/productos/${id}/activar`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    mostrarMensaje(data.mensaje || data.error);

    cargarProductos();
  } catch (error) {
    mostrarMensaje("Error al activar producto.");
  }
}

async function cargarProductosPadre() {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    productoPadre.innerHTML = `
      <option value="">Selecciona producto padre...</option>
    `;

    data
      .filter((p) => Number(p.es_derivado || 0) === 0)
      .forEach((p) => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.nombre} - ${p.presentacion || p.unidad}`;
        productoPadre.appendChild(option);
      });

  } catch (error) {
    mostrarMensaje("Error al cargar productos padre.");
  }
}

const buscarProducto = document.getElementById("buscarProducto");

buscarProducto?.addEventListener("input", () => {
  const texto = buscarProducto.value.toLowerCase().trim();

  const filtrados = productos.filter((p) =>
    String(p.nombre || "").toLowerCase().includes(texto) ||
    String(p.codigo_barras || "").toLowerCase().includes(texto) ||
    String(p.categoria || "").toLowerCase().includes(texto) ||
    String(p.marca || "").toLowerCase().includes(texto) ||
    String(p.presentacion || "").toLowerCase().includes(texto)
  );

  renderProductos(filtrados);
});

async function cargarTiposEnvase() {
  try {
    const response = await fetch(`${API_URL}/importes/tipos-envase`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar tipos de envase.");
      return;
    }

    tiposEnvase = data;

    tipoEnvaseRetornable.innerHTML = `
      <option value="">Selecciona tipo de envase...</option>
    `;

    tiposEnvase.forEach((tipo) => {
      const option = document.createElement("option");
      option.value = tipo.id;
      option.textContent = `${tipo.categoria} - ${tipo.nombre} ($${Number(tipo.importe).toFixed(2)})`;
      tipoEnvaseRetornable.appendChild(option);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar tipos de envase.");
  }
}
