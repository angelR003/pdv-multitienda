const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));

const tiendaId = Number(localStorage.getItem("tienda_id"));
const tiendaNombre = localStorage.getItem("tienda_nombre");

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const esAdmin = usuario?.rol === "administrador";

const tablaInventario = document.getElementById("tablaInventario");
const buscador = document.getElementById("buscador");
const filtroEstado = document.getElementById("filtroEstado");
const mensaje = document.getElementById("mensaje");
const modalLimites = document.getElementById("modalLimites");
const limitesProducto = document.getElementById("limitesProducto");
const limiteMinimo = document.getElementById("limiteMinimo");
const limiteMaximo = document.getElementById("limiteMaximo");
const btnGuardarLimites = document.getElementById("btnGuardarLimites");
const btnCerrarLimites = document.getElementById("btnCerrarLimites");
const modalCantidad = document.getElementById("modalCantidad");
const cantidadProducto = document.getElementById("cantidadProducto");
const cantidadActualTexto = document.getElementById("cantidadActualTexto");
const cantidadNueva = document.getElementById("cantidadNueva");
const diferenciaCantidad = document.getElementById("diferenciaCantidad");
const motivoCantidad = document.getElementById("motivoCantidad");
const mensajeCantidad = document.getElementById("mensajeCantidad");
const btnRestarCantidad = document.getElementById("btnRestarCantidad");
const btnSumarCantidad = document.getElementById("btnSumarCantidad");
const btnGuardarCantidad = document.getElementById("btnGuardarCantidad");
const btnCerrarCantidad = document.getElementById("btnCerrarCantidad");

let inventarioEditandoId = null;
let cantidadEditandoId = null;

let inventario = [];

if (new URLSearchParams(window.location.search).get("filtro") === "bajo") {
  filtroEstado.value = "bajo";
}

cargarInventario();

buscador.addEventListener("input", renderInventario);
filtroEstado.addEventListener("change", renderInventario);

btnCerrarLimites.addEventListener("click", cerrarModalLimites);

btnGuardarLimites.addEventListener("click", guardarLimites);
btnCerrarCantidad.addEventListener("click", cerrarModalCantidad);
btnGuardarCantidad.addEventListener("click", guardarCantidad);
cantidadNueva.addEventListener("input", () => {
  ocultarMensajeCantidad();
  actualizarDiferenciaCantidad();
});
motivoCantidad.addEventListener("input", ocultarMensajeCantidad);
btnRestarCantidad.addEventListener("click", () => cambiarCantidad(-1));
btnSumarCantidad.addEventListener("click", () => cambiarCantidad(1));

async function cargarInventario() {
  try {
    const response = await fetch(
      `${API_URL}/inventario/tienda/${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar inventario.");
      return;
    }

    inventario = data;
    renderInventario();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function renderInventario() {
  const texto = buscador.value.toLowerCase().trim();
  const estado = filtroEstado.value;
  const filtrado = inventario.filter((item) => {
    const coincideTexto =
      item.producto.toLowerCase().includes(texto) ||
      (item.codigo_barras || "").includes(texto);
    const estaBajo =
      Number(item.cantidad_actual) <= Number(item.cantidad_minima);

    if (estado === "bajo") return coincideTexto && estaBajo;
    if (estado === "ok") return coincideTexto && !estaBajo;
    return coincideTexto;
  });

  tablaInventario.innerHTML = "";

  filtrado.forEach((item) => {
    const esVistaDerivada = Number(item.es_vista_derivada || 0) === 1;
    const tieneFilaLegacy =
      Number(item.es_diagnostico_legacy || 0) === 1;
    const estaBajo =
      Number(item.cantidad_actual) <= Number(item.cantidad_minima);
    const tr = document.createElement("tr");
    const descripcionDerivada = esVistaDerivada
      ? `<div class="text-xs text-cyan-300 font-bold">Vista derivada; inventario físico en ${item.producto_fisico_nombre || "padre no disponible"}</div>`
      : "";
    const diagnosticoLegacy = tieneFilaLegacy
      ? `<div class="text-xs text-amber-300 font-bold">Diagnóstico: fila hijo legacy ${formatearNumeroSinMentir(Number(item.cantidad_legacy_hijo || 0))}; no se usa como existencia</div>`
      : "";
    const origenFisico = esVistaDerivada
      ? `<div class="text-xs text-zinc-400">Calculado desde ${formatearNumeroSinMentir(Number(item.cantidad_fisica_autoritativa || 0))} ${item.unidad_fisica || "unidades físicas"}</div>`
      : "";
    const acciones =
      esAdmin && !esVistaDerivada
        ? `
          <div class="flex flex-wrap gap-2">
            <button class="bg-orange-500 hover:bg-orange-400 text-black px-4 py-2 rounded-xl font-bold" onclick="abrirModalCantidad(${item.id})">Existencia</button>
            <button class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-bold" onclick="abrirModalLimites(${item.id})">Límites</button>
          </div>
        `
        : esVistaDerivada
          ? `<span class="text-cyan-300 text-sm">Ajusta ${item.producto_fisico_nombre || "el producto padre"}</span>`
          : `<span class="text-zinc-500 text-sm">Solo admin</span>`;

    tr.innerHTML = `
      <td class="p-3 font-semibold">
        ${item.producto}
        ${descripcionDerivada}
        ${diagnosticoLegacy}
        <div class="text-xs text-zinc-500">${item.codigo_barras || "Sin código"}</div>
      </td>
      <td class="p-3 text-zinc-300">${item.tipo_producto}</td>
      <td class="p-3 text-xl font-bold">
        ${formatearExistencia(item, item.cantidad_actual)}
        ${origenFisico}
      </td>
      <td class="p-3 text-zinc-300">${formatearExistencia(item, item.cantidad_minima)}</td>
      <td class="p-3 text-zinc-300">${formatearExistencia(item, item.cantidad_maxima)}</td>
      <td class="p-3">
        <span class="${
          estaBajo
            ? "bg-red-500/20 text-red-300 border-red-500/30"
            : "bg-green-500/20 text-green-300 border-green-500/30"
        } border px-3 py-1 rounded-full text-xs font-bold">
          ${estaBajo ? "BAJO" : "OK"}
        </span>
      </td>
      <td class="p-3">${acciones}</td>
    `;

    tablaInventario.appendChild(tr);
  });

  if (filtrado.length === 0) {
    tablaInventario.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-zinc-500">
          No se encontraron productos.
        </td>
      </tr>
    `;
  }
}

function formatearExistencia(item, valor) {
  const numero = Number(valor || 0);
  const unidadesPorPaquete = obtenerUnidadesPorPaquete(item);

  if (unidadesPorPaquete > 1 && Number(item.es_derivado || 0) === 0) {
    const paquetes = Math.floor(numero + 0.000001);
    const restanteDecimal = Math.max(0, numero - paquetes);
    let piezas = Math.round(restanteDecimal * unidadesPorPaquete);
    let paquetesAjustados = paquetes;

    if (piezas === unidadesPorPaquete) {
      paquetesAjustados += 1;
      piezas = 0;
    }

    const nombrePaquete = item.presentacion || item.unidad || "paquete";
    const nombrePieza = item.unidad_derivada || "pieza";

    if (piezas === 0) {
      return `${paquetesAjustados} ${pluralizar(nombrePaquete, paquetesAjustados)}`;
    }

    return `${paquetesAjustados} ${pluralizar(nombrePaquete, paquetesAjustados)} + ${piezas} ${pluralizar(nombrePieza, piezas)}`;
  }

  return `${formatearNumeroSinMentir(numero)} ${item.unidad}`;
}

function obtenerUnidadesPorPaquete(item) {
  const factor = Number(item.factor_conversion_derivado || 0);

  if (!factor || factor <= 0 || factor >= 1) {
    return 0;
  }

  return Math.round(1 / factor);
}

function formatearNumeroSinMentir(numero) {
  if (Number.isInteger(numero)) {
    return String(numero);
  }

  return numero.toFixed(3).replace(/\.?0+$/, "");
}

function pluralizar(texto, cantidad) {
  if (cantidad === 1) {
    return texto;
  }

  if (texto.endsWith("s")) {
    return texto;
  }

  return `${texto}s`;
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function abrirModalLimites(id) {
  const item = inventario.find((producto) => producto.id === id);

  if (!item) return;
  if (Number(item.es_vista_derivada || 0) === 1) {
    mostrarMensaje(
      `Los límites se administran en ${item.producto_fisico_nombre || "el producto padre"}.`
    );
    return;
  }

  inventarioEditandoId = item.id;

  limitesProducto.textContent = item.producto;

  limiteMinimo.value = item.cantidad_minima;
  limiteMaximo.value = item.cantidad_maxima;

  modalLimites.classList.remove("hidden");
  modalLimites.classList.add("flex");
}

function cerrarModalLimites() {
  inventarioEditandoId = null;

  limiteMinimo.value = "";
  limiteMaximo.value = "";

  modalLimites.classList.add("hidden");
  modalLimites.classList.remove("flex");
}

async function guardarLimites() {
  if (!inventarioEditandoId) return;

  const body = {
    cantidad_minima: Number(limiteMinimo.value),
    cantidad_maxima: Number(limiteMaximo.value),
  };

  try {
    const response = await fetch(
      `${API_URL}/inventario/${inventarioEditandoId}/limites`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al actualizar límites.");
      return;
    }

    mostrarMensaje("Límites actualizados correctamente.");

    cerrarModalLimites();

    await cargarInventario();

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function abrirModalCantidad(id) {
  if (!esAdmin) return;

  const item = inventario.find((producto) => producto.id === id);
  if (!item) return;
  if (Number(item.es_vista_derivada || 0) === 1) {
    mostrarMensaje(
      `La existencia se ajusta en ${item.producto_fisico_nombre || "el producto padre"}.`
    );
    return;
  }

  cantidadEditandoId = item.id;
  cantidadProducto.textContent = item.producto;
  cantidadActualTexto.textContent = `Existencia actual: ${formatearExistencia(item, item.cantidad_actual)}`;
  cantidadNueva.value = formatearNumeroSinMentir(Number(item.cantidad_actual));
  motivoCantidad.value = "";
  ocultarMensajeCantidad();
  actualizarDiferenciaCantidad();

  modalCantidad.classList.remove("hidden");
  modalCantidad.classList.add("flex");
  cantidadNueva.focus();
  cantidadNueva.select();
}

function cerrarModalCantidad() {
  cantidadEditandoId = null;
  cantidadNueva.value = "";
  motivoCantidad.value = "";
  ocultarMensajeCantidad();
  diferenciaCantidad.textContent = "";
  modalCantidad.classList.add("hidden");
  modalCantidad.classList.remove("flex");
}

function cambiarCantidad(diferencia) {
  const actual = Number(cantidadNueva.value || 0);
  cantidadNueva.value = formatearNumeroSinMentir(Math.max(0, actual + diferencia));
  actualizarDiferenciaCantidad();
}

function actualizarDiferenciaCantidad() {
  const item = inventario.find((producto) => producto.id === cantidadEditandoId);
  const nueva = obtenerCantidadNueva();

  if (!item || nueva === null) {
    diferenciaCantidad.textContent = "Ingresa una cantidad válida.";
    diferenciaCantidad.className = "text-sm font-bold text-red-400 mb-4";
    return;
  }

  const diferencia = Number((nueva - Number(item.cantidad_actual)).toFixed(3));
  diferenciaCantidad.textContent = `Cambio: ${diferencia > 0 ? "+" : ""}${formatearNumeroSinMentir(diferencia)}`;
  diferenciaCantidad.className = `text-sm font-bold mb-4 ${
    diferencia < 0 ? "text-red-400" : diferencia > 0 ? "text-green-400" : "text-zinc-400"
  }`;
}

async function guardarCantidad() {
  const item = inventario.find((producto) => producto.id === cantidadEditandoId);
  const nueva = obtenerCantidadNueva();
  const motivo = motivoCantidad.value.trim();

  if (!item || nueva === null) {
    mostrarMensajeCantidad("Ingresa una cantidad válida.");
    return;
  }

  if (!motivo) {
    mostrarMensajeCantidad("Escribe el motivo del ajuste.");
    motivoCantidad.focus();
    return;
  }

  btnGuardarCantidad.disabled = true;

  try {
    const response = await fetch(`${API_URL}/ajustes-inventario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tienda_id: tiendaId,
        producto_id: item.producto_id,
        cantidad_nueva: nueva,
        motivo,
        observaciones: "Ajuste realizado desde la pantalla de inventario",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensajeCantidad(data.error || "Error al actualizar la existencia.");
      return;
    }

    cerrarModalCantidad();
    mostrarMensaje(`Existencia actualizada: ${formatearNumeroSinMentir(data.cantidad_anterior)} → ${formatearNumeroSinMentir(data.cantidad_nueva)}.`);
    await cargarInventario();
  } catch (error) {
    mostrarMensajeCantidad("Error al conectar.");
  } finally {
    btnGuardarCantidad.disabled = false;
  }
}

function obtenerCantidadNueva() {
  if (cantidadNueva.value.trim() === "") return null;

  const cantidad = Number(cantidadNueva.value);
  return Number.isFinite(cantidad) && cantidad >= 0 ? cantidad : null;
}

function mostrarMensajeCantidad(texto) {
  mensajeCantidad.textContent = texto;
  mensajeCantidad.classList.remove("hidden");
}

function ocultarMensajeCantidad() {
  mensajeCantidad.textContent = "";
  mensajeCantidad.classList.add("hidden");
}
