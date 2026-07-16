const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const esAdmin = usuario.rol === "administrador";
if (!token || !usuario) {
  window.location.href = "./login.html";
}

const producto = document.getElementById("producto");
const buscarProductoAjuste = document.getElementById("buscarProductoAjuste");
const resultadosProductoAjuste = document.getElementById("resultadosProductoAjuste");
const cantidadNueva = document.getElementById("cantidadNueva");
const labelCantidadNueva = document.getElementById("labelCantidadNueva");
const grupoPiezasSueltas = document.getElementById("grupoPiezasSueltas");
const piezasSueltas = document.getElementById("piezasSueltas");
const labelPiezasSueltas = document.getElementById("labelPiezasSueltas");
const motivo = document.getElementById("motivo");
const observaciones = document.getElementById("observaciones");

const btnAjustar = document.getElementById("btnAjustar");

const mensaje = document.getElementById("mensaje");

const tablaAjustes = document.getElementById("tablaAjustes");

let productos = [];

btnAjustar.addEventListener("click", async () => {
  await realizarAjuste();
});

producto.addEventListener("change", actualizarCampoCantidad);
buscarProductoAjuste?.addEventListener("input", renderResultadosProductoAjuste);
buscarProductoAjuste?.addEventListener("focus", renderResultadosProductoAjuste);

document.addEventListener("click", (event) => {
  if (
    !buscarProductoAjuste?.contains(event.target) &&
    !resultadosProductoAjuste?.contains(event.target)
  ) {
    resultadosProductoAjuste?.classList.add("hidden");
  }
});

cargarProductos();
cargarAjustes();

async function cargarProductos() {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const productosRecibidos = await response.json();
    productos = Array.isArray(productosRecibidos)
      ? productosRecibidos
      : [];

    producto.innerHTML = "";

    productos.forEach((item) => {
      const option = document.createElement("option");

      option.value = item.id;
      option.dataset.factorConversionDerivado = item.factor_conversion_derivado || "";
      option.dataset.presentacion = item.presentacion || "";
      option.dataset.unidad = item.unidad || "";
      option.dataset.esDerivado = item.es_derivado || 0;
      const esDerivado = Number(item.es_derivado || 0) === 1;
      option.disabled = esDerivado;

      const unidadesPorPaquete = obtenerUnidadesPorPaquete(item);
      const nombreUnidad =
        unidadesPorPaquete > 1 && Number(item.es_derivado || 0) === 0
          ? item.presentacion || item.unidad
          : item.unidad;

      option.textContent = esDerivado
        ? `${item.nombre} — derivado; ajustar ${item.producto_padre_nombre || "producto padre"}`
        : `${item.nombre} (${nombreUnidad})`;

      producto.appendChild(option);
    });

    actualizarCampoCantidad();
    const primerProductoFisico = productos.find(
      (item) => Number(item.es_derivado || 0) === 0
    );
    if (primerProductoFisico && !buscarProductoAjuste.value) {
      seleccionarProductoAjuste(primerProductoFisico, false);
    }

  } catch (error) {
    mostrarMensaje("Error al cargar productos.");
  }
}

async function realizarAjuste() {
  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) {
    mostrarMensaje("Selecciona un producto.");
    return;
  }

  if (Number(productoSeleccionado.es_derivado || 0) === 1) {
    mostrarMensaje(
      `Ajusta la existencia en ${productoSeleccionado.producto_padre_nombre || "el producto padre"}.`
    );
    return;
  }

  const cantidadCalculada = calcularCantidadDesdeFormulario(productoSeleccionado);

  if (cantidadCalculada === null) {
    return;
  }

  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    producto_id: Number(producto.value),
    cantidad_nueva: cantidadCalculada,
    motivo: motivo.value.trim(),
    observaciones: observaciones.value.trim(),
  };

  if (!body.producto_id || isNaN(body.cantidad_nueva)) {
    mostrarMensaje("Datos inválidos.");
    return;
  }

  if (!body.motivo) {
    mostrarMensaje("El motivo es obligatorio.");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/ajustes-inventario`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al ajustar.");
      return;
    }

    mostrarMensaje("Ajuste realizado correctamente.");

    cantidadNueva.value = "";
    piezasSueltas.value = "";
    motivo.value = "";
    observaciones.value = "";

    cargarAjustes();

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function cargarAjustes() {
  try {
    const response = await fetch(
      `${API_URL}/ajustes-inventario`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const ajustes = await response.json();

    tablaAjustes.innerHTML = "";

    ajustes.forEach((ajuste) => {
      const tr = document.createElement("tr");

      const color =
        ajuste.diferencia < 0
          ? "text-red-400"
          : "text-green-400";

      tr.innerHTML = `
        <td class="p-3 font-semibold">
          ${ajuste.producto}
        </td>

        <td class="p-3">
          ${ajuste.cantidad_anterior}
        </td>

        <td class="p-3">
          ${ajuste.cantidad_nueva}
        </td>

        <td class="p-3 font-bold ${color}">
          ${ajuste.diferencia > 0 ? "+" : ""}
          ${ajuste.diferencia}
        </td>

        <td class="p-3">
          ${ajuste.motivo}
        </td>

        <td class="p-3 text-zinc-400">
          ${ajuste.usuario}
        </td>

        <td class="p-3 text-zinc-500 text-sm">
          ${formatearFechaLocal(ajuste.fecha_ajuste)}
        </td>
      `;

      tablaAjustes.appendChild(tr);
    });

  } catch (error) {
    mostrarMensaje("Error al cargar ajustes.");
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function obtenerProductoSeleccionado() {
  return productos.find(
    (item) => Number(item.id) === Number(producto.value)
  );
}

function renderResultadosProductoAjuste() {
  if (!resultadosProductoAjuste) return;

  const texto = normalizarTexto(buscarProductoAjuste.value);
  const filtrados = productos
    .filter((item) => productoCoincideBusqueda(item, texto))
    .slice(0, 10);

  resultadosProductoAjuste.innerHTML = "";

  if (filtrados.length === 0) {
    resultadosProductoAjuste.innerHTML = `
      <div class="p-4 text-sm text-zinc-500">No hay productos activos.</div>
    `;
    resultadosProductoAjuste.classList.remove("hidden");
    return;
  }

  filtrados.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    const esDerivado = Number(item.es_derivado || 0) === 1;
    button.disabled = esDerivado;
    button.className = "w-full text-left px-4 py-3 hover:bg-zinc-900 border-b border-zinc-800 last:border-b-0";
    const unidadesPorPaquete = obtenerUnidadesPorPaquete(item);
    const nombreUnidad =
      unidadesPorPaquete > 1 && Number(item.es_derivado || 0) === 0
        ? item.presentacion || item.unidad
        : item.unidad;

    button.innerHTML = `
      <div class="font-black">${item.nombre}</div>
      <div class="text-xs text-zinc-500">
        ${item.codigo_barras || "Sin codigo"}${item.marca ? ` - ${item.marca}` : ""}${item.categoria ? ` - ${item.categoria}` : ""}${item.presentacion ? ` - ${item.presentacion}` : ""}
      </div>
      <div class="text-xs text-zinc-400 mt-1">${nombreUnidad}</div>
      ${
        esDerivado
          ? `<div class="text-xs text-amber-300 mt-1">Derivado: ajusta ${item.producto_padre_nombre || "el producto padre"}</div>`
          : ""
      }
    `;
    if (!esDerivado) {
      button.addEventListener("click", () => seleccionarProductoAjuste(item));
    }
    resultadosProductoAjuste.appendChild(button);
  });

  resultadosProductoAjuste.classList.remove("hidden");
}

function seleccionarProductoAjuste(item, enfocarCantidad = true) {
  producto.value = item.id;
  buscarProductoAjuste.value = `${item.nombre} - ${item.presentacion || item.unidad}`;
  resultadosProductoAjuste?.classList.add("hidden");
  actualizarCampoCantidad();

  if (enfocarCantidad) {
    cantidadNueva.focus();
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

function actualizarCampoCantidad() {
  const productoSeleccionado = obtenerProductoSeleccionado();

  if (!productoSeleccionado) return;

  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);

  if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const nombrePaquete = productoSeleccionado.presentacion || productoSeleccionado.unidad;
    labelCantidadNueva.textContent = `${pluralizar(capitalizar(nombrePaquete))} ${terminacionCerrado(nombrePaquete)}`;
    cantidadNueva.placeholder = `Ejemplo: 1`;
    grupoPiezasSueltas.classList.remove("hidden");
    labelPiezasSueltas.textContent = `Piezas sueltas (0 a ${unidadesPorPaquete - 1})`;
    piezasSueltas.max = String(unidadesPorPaquete - 1);
    return;
  }

  grupoPiezasSueltas.classList.add("hidden");
  piezasSueltas.value = "";
  labelCantidadNueva.textContent = "Nueva cantidad";
  cantidadNueva.placeholder = "Nueva cantidad...";
}

function calcularCantidadDesdeFormulario(productoSeleccionado) {
  const unidadesPorPaquete = obtenerUnidadesPorPaquete(productoSeleccionado);
  const paquetes = Number(cantidadNueva.value || 0);

  if (unidadesPorPaquete > 1 && Number(productoSeleccionado.es_derivado || 0) === 0) {
    const piezas = Number(piezasSueltas.value || 0);

    if (!Number.isInteger(paquetes) || paquetes < 0) {
      mostrarMensaje("La cantidad de paquetes debe ser entera.");
      return null;
    }

    if (!Number.isInteger(piezas) || piezas < 0 || piezas >= unidadesPorPaquete) {
      mostrarMensaje(`Las piezas sueltas deben estar entre 0 y ${unidadesPorPaquete - 1}.`);
      return null;
    }

    if (paquetes === 0 && piezas === 0) {
      mostrarMensaje("La cantidad nueva no puede quedar vacia.");
      return null;
    }

    return paquetes + piezas / unidadesPorPaquete;
  }

  const cantidad = Number(cantidadNueva.value);

  if (isNaN(cantidad) || cantidad < 0) {
    mostrarMensaje("Datos invalidos.");
    return null;
  }

  return cantidad;
}

function obtenerUnidadesPorPaquete(item) {
  const factor = Number(item.factor_conversion_derivado || 0);

  if (!factor || factor <= 0 || factor >= 1) {
    return 0;
  }

  return Math.round(1 / factor);
}

function capitalizar(texto) {
  if (!texto) {
    return "Paquete";
  }

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function pluralizar(texto) {
  if (texto.endsWith("s")) {
    return texto;
  }

  return `${texto}s`;
}

function terminacionCerrado(texto) {
  return String(texto || "").toLowerCase().endsWith("a") ? "cerradas" : "cerrados";
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
