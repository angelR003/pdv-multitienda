const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!token || !usuario) {
  window.location.href = "./login.html";
}

if (usuario.rol !== "administrador") {
  window.location.href = "./dashboard.html";
}

const productoPromocion = document.getElementById("productoPromocion");
const buscarProductoPromocion = document.getElementById("buscarProductoPromocion");
const resultadosProductoPromocion = document.getElementById("resultadosProductoPromocion");
const cantidadRequerida = document.getElementById("cantidadRequerida");
const precioPromocion = document.getElementById("precioPromocion");
const btnGuardarPromocion = document.getElementById("btnGuardarPromocion");
const tablaPromociones = document.getElementById("tablaPromociones");
const mensaje = document.getElementById("mensaje");

let productosElegibles = [];

btnGuardarPromocion.addEventListener("click", crearPromocion);
buscarProductoPromocion?.addEventListener("input", renderResultadosProductoPromocion);
buscarProductoPromocion?.addEventListener("focus", renderResultadosProductoPromocion);

document.addEventListener("click", (event) => {
  if (
    !buscarProductoPromocion?.contains(event.target) &&
    !resultadosProductoPromocion?.contains(event.target)
  ) {
    resultadosProductoPromocion?.classList.add("hidden");
  }
});

inicializarPromociones();

async function inicializarPromociones() {
  await cargarProductosElegibles();
  await cargarPromociones();
}

async function cargarProductosElegibles() {
  try {
    const response = await fetch(`${API_URL}/promociones/productos-elegibles`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const productos = await response.json();

    if (!response.ok) {
      mostrarMensaje(productos.error || "Error al cargar productos elegibles.");
      return;
    }

    productosElegibles = productos;
    productoPromocion.innerHTML = `
      <option value="">Selecciona producto...</option>
    `;

    productos.forEach((producto) => {
      const option = document.createElement("option");

      option.value = producto.id;
      option.textContent =
        `${producto.nombre} - $${Number(producto.precio_global).toFixed(2)} / ${producto.unidad}`;

      productoPromocion.appendChild(option);
    });
  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al conectar al cargar productos.");
  }
}

async function cargarPromociones() {
  try {
    const response = await fetch(`${API_URL}/promociones`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const promociones = await response.json();

    if (!response.ok) {
      mostrarMensaje(promociones.error || "Error al cargar promociones.");
      return;
    }

    renderPromociones(promociones);
  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al conectar al cargar promociones.");
  }
}

async function crearPromocion() {
  const body = {
    producto_id: Number(productoPromocion.value),
    cantidad_requerida: Number(cantidadRequerida.value),
    precio_promocion: Number(precioPromocion.value),
  };

  if (!body.producto_id) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  if (!Number.isInteger(body.cantidad_requerida) || body.cantidad_requerida < 2) {
    mostrarMensaje("La cantidad debe ser un entero mayor o igual a 2.");
    return;
  }

  if (!body.precio_promocion || body.precio_promocion <= 0) {
    mostrarMensaje("El precio de promoción debe ser mayor a 0.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/promociones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al crear promoción.");
      return;
    }

    productoPromocion.value = "";
    buscarProductoPromocion.value = "";
    cantidadRequerida.value = "";
    precioPromocion.value = "";

    mostrarMensaje("Promoción creada correctamente.");

    await cargarPromociones();
  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al conectar al crear promoción.");
  }
}

async function desactivarPromocion(id) {
  const confirmar = confirm("¿Seguro que quieres desactivar esta promoción?");

  if (!confirmar) return;

  try {
    const response = await fetch(`${API_URL}/promociones/${id}/desactivar`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al desactivar promoción.");
      return;
    }

    mostrarMensaje("Promoción desactivada correctamente.");

    await cargarPromociones();
  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al conectar al desactivar promoción.");
  }
}

function renderPromociones(promociones) {
  tablaPromociones.innerHTML = "";

  if (!promociones || promociones.length === 0) {
    tablaPromociones.innerHTML = `
      <tr>
        <td colspan="6" class="p-5 text-center text-zinc-400">
          No hay promociones registradas.
        </td>
      </tr>
    `;

    return;
  }

  promociones.forEach((promo) => {
    const tr = document.createElement("tr");

    const activa = Number(promo.activa) === 1;

    const estadoTexto = activa ? "Activa" : "Inactiva";

    const estadoClase = activa
      ? "bg-green-500/10 text-green-400 border border-green-500/30"
      : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30";

    tr.innerHTML = `
      <td class="p-3 font-semibold">
        ${promo.producto_nombre}
      </td>

      <td class="p-3 text-zinc-300">
        $${Number(promo.precio_global).toFixed(2)} / ${promo.unidad}
      </td>

      <td class="p-3 text-cyan-300 font-bold">
        ${promo.cantidad_requerida} por $${Number(promo.precio_promocion).toFixed(2)}
      </td>

      <td class="p-3">
        <span class="inline-flex px-3 py-1 rounded-full text-xs font-black ${estadoClase}">
          ${estadoTexto}
        </span>
      </td>

      <td class="p-3 text-zinc-500 text-sm">
        ${formatearFechaLocal(promo.fecha_creacion)}
      </td>

      <td class="p-3 text-right">
        ${
          activa
            ? `
              <button
                onclick="desactivarPromocion(${promo.id})"
                class="bg-red-500 hover:bg-red-400 text-black px-4 py-2 rounded-xl font-bold"
              >
                Desactivar
              </button>
            `
            : `
              <span class="text-zinc-500 text-sm">
                Sin acciones
              </span>
            `
        }
      </td>
    `;

    tablaPromociones.appendChild(tr);
  });
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
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
    hour12: false,
  });
}

function renderResultadosProductoPromocion() {
  if (!resultadosProductoPromocion) return;

  const texto = normalizarTexto(buscarProductoPromocion.value);
  const filtrados = productosElegibles
    .filter((producto) => productoCoincideBusqueda(producto, texto))
    .slice(0, 10);

  resultadosProductoPromocion.innerHTML = "";

  if (filtrados.length === 0) {
    resultadosProductoPromocion.innerHTML = `
      <div class="p-4 text-sm text-zinc-500">No hay productos elegibles.</div>
    `;
    resultadosProductoPromocion.classList.remove("hidden");
    return;
  }

  filtrados.forEach((producto) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "w-full text-left px-4 py-3 hover:bg-zinc-900 border-b border-zinc-800 last:border-b-0";
    button.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-black">${producto.nombre}</p>
          <p class="text-xs text-zinc-500">
            ${producto.codigo_barras || "Sin codigo"}${producto.marca ? ` - ${producto.marca}` : ""}${producto.categoria ? ` - ${producto.categoria}` : ""}${producto.presentacion ? ` - ${producto.presentacion}` : ""}
          </p>
        </div>
        <div class="text-right text-sm font-bold text-cyan-300">
          $${Number(producto.precio_global).toFixed(2)}
        </div>
      </div>
    `;
    button.addEventListener("click", () => seleccionarProductoPromocion(producto));
    resultadosProductoPromocion.appendChild(button);
  });

  resultadosProductoPromocion.classList.remove("hidden");
}

function seleccionarProductoPromocion(producto) {
  productoPromocion.value = producto.id;
  buscarProductoPromocion.value = `${producto.nombre} - $${Number(producto.precio_global).toFixed(2)} / ${producto.unidad}`;
  resultadosProductoPromocion?.classList.add("hidden");
  cantidadRequerida.focus();
}

function productoCoincideBusqueda(producto, texto) {
  if (!texto) return true;

  return normalizarTexto([
    producto.nombre,
    producto.codigo_barras,
    producto.categoria,
    producto.marca,
    producto.presentacion,
    producto.unidad,
  ].join(" ")).includes(texto);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizarFechaSQLite(fechaTexto) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)) {
    return fechaTexto;
  }

  return fechaTexto.replace(" ", "T") + "Z";
}
