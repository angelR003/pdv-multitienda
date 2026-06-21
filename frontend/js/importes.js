const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!token || !usuario) {
  window.location.href = "./login.html";
}

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const clienteFiado = document.getElementById("clienteFiado");
const clienteOtro = document.getElementById("clienteOtro");
const categoria = document.getElementById("categoria");
const tipoEnvase = document.getElementById("tipoEnvase");
const cantidad = document.getElementById("cantidad");
const escenario = document.getElementById("escenario");
const observaciones = document.getElementById("observaciones");
const btnRegistrar = document.getElementById("btnRegistrar");
const mensaje = document.getElementById("mensaje");
const tablaImportes = document.getElementById("tablaImportes");
const thTiendaImportes = document.getElementById("thTiendaImportes");
const contenedorEnvases = document.getElementById("contenedorEnvases");
const modalDevolverEnvase = document.getElementById("modalDevolverEnvase");
const cantidadDevolverEnvase = document.getElementById("cantidadDevolverEnvase");
const textoMaximoEnvases = document.getElementById("textoMaximoEnvases");
const btnCancelarDevolucionEnvase = document.getElementById("btnCancelarDevolucionEnvase");
const btnConfirmarDevolucionEnvase = document.getElementById("btnConfirmarDevolucionEnvase");
const mensajeDevolucionEnvase = document.getElementById("mensajeDevolucionEnvase");
const btnAbrirAjusteEnvases = document.getElementById("btnAbrirAjusteEnvases");
const modalAjusteEnvases = document.getElementById("modalAjusteEnvases");
const ajusteTipoEnvase = document.getElementById("ajusteTipoEnvase");
const ajusteCantidadActual = document.getElementById("ajusteCantidadActual");
const ajusteModoEnvase = document.getElementById("ajusteModoEnvase");
const ajusteCantidadEnvase = document.getElementById("ajusteCantidadEnvase");
const ajusteMotivoEnvase = document.getElementById("ajusteMotivoEnvase");
const ajusteObservacionesEnvase = document.getElementById("ajusteObservacionesEnvase");
const mensajeAjusteEnvases = document.getElementById("mensajeAjusteEnvases");
const btnCancelarAjusteEnvases = document.getElementById("btnCancelarAjusteEnvases");
const btnGuardarAjusteEnvases = document.getElementById("btnGuardarAjusteEnvases");
const tablaAjustesEnvases = document.getElementById("tablaAjustesEnvases");
const modalConfigCajaEnvase = document.getElementById("modalConfigCajaEnvase");
const configCajaEnvaseNombre = document.getElementById("configCajaEnvaseNombre");
const configImporteUnitario = document.getElementById("configImporteUnitario");
const grupoConfigCajaEnvase = document.getElementById("grupoConfigCajaEnvase");
const configCantidadPorCaja = document.getElementById("configCantidadPorCaja");
const configImportePorCaja = document.getElementById("configImportePorCaja");
const mensajeConfigCajaEnvase = document.getElementById("mensajeConfigCajaEnvase");
const btnCancelarConfigCajaEnvase = document.getElementById("btnCancelarConfigCajaEnvase");
const btnGuardarConfigCajaEnvase = document.getElementById("btnGuardarConfigCajaEnvase");

let devolucionEnvasePendiente = null;
let tiposEnvase = [];
let inventarioEnvases = [];
let devolucionEnProceso = false;
let ajusteEnvasesEnProceso = false;
let configCajaEnvasePendiente = null;
let configCajaEnvaseEnProceso = false;
let clientesFiado = [];
const mostrarTodasLasTiendas = usuario.rol === "administrador";
const importesEnvases = window.ImportesEnvases;

if (mostrarTodasLasTiendas) {
  thTiendaImportes?.classList.remove("hidden");
}

clienteFiado.addEventListener("change", () => {
  if (clienteFiado.value === "otro") {
    clienteOtro.classList.remove("hidden");
  } else {
    clienteOtro.classList.add("hidden");
    clienteOtro.value = "";
  }
});

categoria.addEventListener("change", renderTiposEnvase);
btnRegistrar.addEventListener("click", registrarImporte);
btnAbrirAjusteEnvases?.addEventListener("click", abrirModalAjusteEnvases);
btnCancelarAjusteEnvases?.addEventListener("click", cerrarModalAjusteEnvases);
btnGuardarAjusteEnvases?.addEventListener("click", guardarAjusteEnvases);
ajusteTipoEnvase?.addEventListener("change", actualizarCantidadActualAjuste);
btnCancelarConfigCajaEnvase?.addEventListener("click", cerrarModalConfigCajaEnvase);
btnGuardarConfigCajaEnvase?.addEventListener("click", guardarConfigCajaEnvase);

cargarTiposEnvase();
cargarClientesFiado();
cargarImportes();
cargarInventarioEnvases();
cargarAjustesEnvases();

async function cargarTiposEnvase() {
  try {
    const response = await fetch(`${API_URL}/importes/tipos-envase`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    tiposEnvase = await response.json();
    renderTiposEnvase();
    renderTiposEnvaseAjuste();
  } catch (error) {
    mostrarMensaje("Error al cargar tipos de envase.");
  }
}

function renderTiposEnvaseAjuste() {
  if (!ajusteTipoEnvase) return;

  ajusteTipoEnvase.innerHTML = "";

  tiposEnvase.forEach((tipo) => {
    const option = document.createElement("option");

    option.value = tipo.id;
    option.textContent = `${tipo.categoria} - ${tipo.nombre}`;

    ajusteTipoEnvase.appendChild(option);
  });

  actualizarCantidadActualAjuste();
}

function renderTiposEnvase() {
  const filtrados = tiposEnvase.filter(
    (tipo) => tipo.categoria === categoria.value,
  );

  tipoEnvase.innerHTML = "";

  filtrados.forEach((tipo) => {
    const option = document.createElement("option");

    option.value = tipo.id;
    option.textContent = obtenerTextoTipoEnvase(tipo);

    tipoEnvase.appendChild(option);
  });
}

function obtenerTextoTipoEnvase(tipo) {
  const textoBase = `${tipo.nombre} - $${Number(tipo.importe).toFixed(2)}`;

  if (
    tipo.categoria === "cerveza" &&
    Number(tipo.cantidad_por_caja || 0) > 0 &&
    Number(tipo.importe_por_caja || 0) > 0
  ) {
    return `${textoBase} / caja ${tipo.cantidad_por_caja} por $${Number(tipo.importe_por_caja).toFixed(2)}`;
  }

  return textoBase;
}

async function registrarImporte() {
  let clienteNombre = "";
  let clienteFiadoId = null;

  if (clienteFiado.value === "otro") {
    clienteNombre = clienteOtro.value.trim();
  } else {
    const clienteSeleccionado = clientesFiado.find(
      (c) => Number(c.id) === Number(clienteFiado.value),
    );

    clienteNombre = clienteSeleccionado?.nombre_completo || "";
    clienteFiadoId = clienteSeleccionado?.id || null;
  }
  const body = {
    tienda_id: tiendaId,
    cliente: clienteNombre,
    cliente_fiado_id: clienteFiadoId,
    tipo_envase_id: Number(tipoEnvase.value),
    escenario: escenario.value,
    cantidad: Number(cantidad.value),
    observaciones: observaciones.value.trim(),
  };

if (
  !body.cliente ||
  !body.tipo_envase_id ||
  !body.escenario ||
  !body.cantidad ||
  body.cantidad <= 0
) {
  mostrarMensaje("Cliente, envase, escenario y cantidad son obligatorios.");
  return;
}

if (!Number.isInteger(body.cantidad)) {
  mostrarMensaje("La cantidad de envases debe ser un numero entero.");
  return;
}
  try {
    const response = await fetch(`${API_URL}/importes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar importe.");
      return;
    }

mostrarMensaje("Importe registrado correctamente.");

clienteFiado.value = "";
clienteOtro.value = "";
clienteOtro.classList.add("hidden");
cantidad.value = "";
observaciones.value = "";
escenario.value = "";

await cargarImportes();
await cargarInventarioEnvases();
cargarInventarioEnvases

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

async function cargarImportes() {
  try {
    const params = new URLSearchParams();

    if (mostrarTodasLasTiendas) {
      params.set("todas", "1");
    } else {
      params.set("tienda_id", tiendaId);
    }

    const response = await fetch(`${API_URL}/importes?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    tablaImportes.innerHTML = "";

    data.forEach((item) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="p-3 font-semibold">${item.cliente}</td>
        ${
          mostrarTodasLasTiendas
            ? `<td class="p-3 text-zinc-400">${item.tienda || "-"}</td>`
            : ""
        }
        <td class="p-3">${item.tipo_envase}</td>
        <td class="p-3 text-zinc-400">${item.escenario}</td>
        <td class="p-3 font-bold">${item.cantidad_pendiente}</td>
        <td class="p-3 text-green-400 font-bold">$${Number(item.importe_total).toFixed(2)}</td>
        <td class="p-3">
          <button
            class="bg-lime-500 hover:bg-lime-400 text-black px-4 py-2 rounded-xl font-bold"
            onclick="devolverEnvase(${item.id}, ${item.cantidad_pendiente})"
          >
            Recibir
          </button>
        </td>
      `;

      tablaImportes.appendChild(tr);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar importes.");
  }
}

async function devolverEnvase(id, maximo) {
  devolucionEnvasePendiente = {
    id,
    maximo: Number(maximo),
  };

  textoMaximoEnvases.textContent = `Máximo permitido: ${maximo}`;
  cantidadDevolverEnvase.value = "";
  cantidadDevolverEnvase.max = maximo;
  mensajeDevolucionEnvase.textContent = "";
  modalDevolverEnvase.classList.remove("hidden");

  setTimeout(() => {
    cantidadDevolverEnvase.focus();
  }, 100);
}

btnCancelarDevolucionEnvase?.addEventListener("click", () => {
  if (devolucionEnProceso) return;

  modalDevolverEnvase.classList.add("hidden");
  devolucionEnvasePendiente = null;
  cantidadDevolverEnvase.value = "";
});

btnConfirmarDevolucionEnvase?.addEventListener("click", async () => {
  if (devolucionEnProceso) return;
  if (!devolucionEnvasePendiente) return;

  const cantidad = Number(cantidadDevolverEnvase.value);
  const { id, maximo } = devolucionEnvasePendiente;

if (!cantidad || cantidad <= 0) {
  mensajeDevolucionEnvase.textContent = "Ingresa una cantidad valida.";
  return;
}

  if (!Number.isInteger(cantidad)) {
  mensajeDevolucionEnvase.textContent = "La cantidad debe ser un numero entero.";
  return;
}

if (cantidad > maximo) {
  mensajeDevolucionEnvase.textContent = `No puedes recibir mas de ${maximo} envases.`;
  return;
}

  devolucionEnProceso = true;
  btnConfirmarDevolucionEnvase.disabled = true;
  btnConfirmarDevolucionEnvase.textContent = "Procesando...";

  try {
    const response = await fetch(`${API_URL}/importes/${id}/devolver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cantidad }),
    });

    const data = await response.json();

if (!response.ok) {
  mensajeDevolucionEnvase.textContent =
    data.error || "Error al recibir envases.";
  return;
}

    mostrarMensaje(data.mensaje || "Envases recibidos correctamente.");

    modalDevolverEnvase.classList.add("hidden");
    devolucionEnvasePendiente = null;
    cantidadDevolverEnvase.value = "";

    await cargarImportes();
    await cargarInventarioEnvases();
  } catch (error) {
    console.error("ERROR RECIBIR ENVASE:", error);
    mostrarMensaje("Error al conectar.");
  } finally {
    devolucionEnProceso = false;
    btnConfirmarDevolucionEnvase.disabled = false;
    btnConfirmarDevolucionEnvase.textContent = "Confirmar";
  }
});

async function cargarInventarioEnvases() {
  try {
    const response = await fetch(
      `${API_URL}/importes/inventario-envases?tienda_id=${tiendaId}&t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar envases.");
      return;
    }

    inventarioEnvases = data;
    actualizarCantidadActualAjuste();
    contenedorEnvases.innerHTML = "";

    data.forEach((envase) => {
      const card = document.createElement("div");

      card.className =
        "bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-lg";

      card.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase text-zinc-500 font-bold">
              ${envase.categoria}
            </p>

            <h3 class="text-lg font-black mt-1">
              ${envase.nombre}
            </h3>

            <p class="text-zinc-500 text-sm mt-1">
              Importe: $${Number(envase.importe).toFixed(2)}
            </p>

            ${
              envase.categoria === "cerveza"
                ? Number(envase.cantidad_por_caja || 0) > 0 &&
                  Number(envase.importe_por_caja || 0) > 0
                  ? `
                    <p class="text-yellow-300 text-sm mt-1">
                      Caja: ${envase.cantidad_por_caja} por $${Number(envase.importe_por_caja).toFixed(2)}
                    </p>
                  `
                  : `
                    <p class="text-zinc-600 text-sm mt-1">
                      Sin importe por caja
                    </p>
                  `
                : ""
            }

            ${
              usuario.rol === "administrador"
                ? `
                  <button
                    type="button"
                    class="mt-3 bg-yellow-400 hover:bg-yellow-300 text-black px-3 py-2 rounded-xl text-sm font-bold"
                    style="background:#facc15;color:#000;border:1px solid #fde047;box-shadow:0 0 0 1px rgba(250,204,21,.25);"
                    onclick="abrirModalConfigCajaEnvase(${envase.id})"
                  >
                    Editar importes
                  </button>
                `
                : ""
            }
          </div>

          <div class="text-right">
            <p class="text-4xl font-black text-lime-300">
              ${envase.cantidad_vacios}
            </p>
            <p class="text-zinc-500 text-xs">
              vacíos
            </p>
          </div>
        </div>
      `;

      contenedorEnvases.appendChild(card);
    });
  } catch (error) {
    console.error("ERROR ENVASES:", error);
    mostrarMensaje("Error al cargar envases.");
  }
}

async function cargarClientesFiado() {
  const response = await fetch(`${API_URL}/fiados/clientes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  clientesFiado = await response.json();

  clienteFiado.innerHTML = `
    <option value="">Selecciona cliente...</option>
    <option value="otro">Otro</option>
  `;

  clientesFiado.forEach((cliente) => {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = cliente.nombre_completo;
    clienteFiado.appendChild(option);
  });
}

function abrirModalConfigCajaEnvase(tipoEnvaseId) {
  const envase = inventarioEnvases.find(
    (item) => Number(item.id) === Number(tipoEnvaseId)
  );

  if (!envase) {
    mostrarMensaje("Tipo de envase no encontrado.");
    return;
  }

  configCajaEnvasePendiente = envase;
  configCajaEnvaseNombre.textContent = `${envase.categoria} - ${envase.nombre}`;
  configImporteUnitario.value = Number(envase.importe || 0).toFixed(2);
  configCantidadPorCaja.value = envase.cantidad_por_caja || "";
  configImportePorCaja.value = envase.importe_por_caja || "";
  grupoConfigCajaEnvase.classList.toggle("hidden", envase.categoria !== "cerveza");
  mensajeConfigCajaEnvase.textContent = "";
  modalConfigCajaEnvase.classList.remove("hidden");

  setTimeout(() => {
    configImporteUnitario.focus();
    configImporteUnitario.select();
  }, 100);
}

function cerrarModalConfigCajaEnvase() {
  if (configCajaEnvaseEnProceso) return;

  modalConfigCajaEnvase.classList.add("hidden");
  configCajaEnvasePendiente = null;
}

async function guardarConfigCajaEnvase() {
  if (configCajaEnvaseEnProceso || !configCajaEnvasePendiente) return;

  const importeUnitario = Number(configImporteUnitario.value);
  const esEnvaseCerveza = configCajaEnvasePendiente.categoria === "cerveza";
  const cantidadPorCaja = !esEnvaseCerveza || configCantidadPorCaja.value === ""
    ? null
    : Number(configCantidadPorCaja.value);
  const importePorCaja = !esEnvaseCerveza || configImportePorCaja.value === ""
    ? null
    : Number(configImportePorCaja.value);

  if (!Number.isFinite(importeUnitario) || importeUnitario <= 0) {
    mensajeConfigCajaEnvase.textContent =
      "El importe unitario debe ser mayor a 0.";
    return;
  }

  if (
    cantidadPorCaja != null &&
    (!Number.isInteger(cantidadPorCaja) || cantidadPorCaja <= 0)
  ) {
    mensajeConfigCajaEnvase.textContent =
      "La cantidad por caja debe ser entera y mayor a 0.";
    return;
  }

  if (importePorCaja != null && importePorCaja <= 0) {
    mensajeConfigCajaEnvase.textContent =
      "El importe por caja debe ser mayor a 0.";
    return;
  }

  configCajaEnvaseEnProceso = true;
  btnGuardarConfigCajaEnvase.disabled = true;
  btnGuardarConfigCajaEnvase.textContent = "Guardando...";

  try {
    const response = await fetch(
      `${API_URL}/importes/tipos-envase/${configCajaEnvasePendiente.id}/configuracion`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          importe: importeUnitario,
          cantidad_por_caja: cantidadPorCaja,
          importe_por_caja: importePorCaja,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mensajeConfigCajaEnvase.textContent =
        data.error || "Error al guardar configuracion.";
      return;
    }

    mostrarMensaje(data.mensaje || "Configuracion de caja actualizada.");
    configCajaEnvaseEnProceso = false;
    cerrarModalConfigCajaEnvase();
    await cargarTiposEnvase();
    await cargarInventarioEnvases();
  } catch (error) {
    mensajeConfigCajaEnvase.textContent = "Error al conectar.";
  } finally {
    configCajaEnvaseEnProceso = false;
    btnGuardarConfigCajaEnvase.disabled = false;
    btnGuardarConfigCajaEnvase.textContent = "Guardar";
  }
}

function abrirModalAjusteEnvases() {
  renderTiposEnvaseAjuste();
  ajusteModoEnvase.value = "sumar";
  ajusteCantidadEnvase.value = "";
  ajusteMotivoEnvase.value = "";
  ajusteObservacionesEnvase.value = "";
  mensajeAjusteEnvases.textContent = "";
  modalAjusteEnvases.classList.remove("hidden");

  setTimeout(() => {
    ajusteCantidadEnvase.focus();
  }, 100);
}

function cerrarModalAjusteEnvases() {
  if (ajusteEnvasesEnProceso) return;

  modalAjusteEnvases.classList.add("hidden");
}

function obtenerInventarioEnvaseActual(tipoEnvaseId) {
  return inventarioEnvases.find(
    (envase) => Number(envase.id) === Number(tipoEnvaseId)
  );
}

function actualizarCantidadActualAjuste() {
  if (!ajusteCantidadActual || !ajusteTipoEnvase) return;

  const envase = obtenerInventarioEnvaseActual(ajusteTipoEnvase.value);

  ajusteCantidadActual.value = envase
    ? `${envase.cantidad_vacios} vacios`
    : "0 vacios";
}

async function guardarAjusteEnvases() {
  if (ajusteEnvasesEnProceso) return;

  const body = {
    tienda_id: tiendaId,
    tipo_envase_id: Number(ajusteTipoEnvase.value),
    modo: ajusteModoEnvase.value,
    cantidad: Number(ajusteCantidadEnvase.value),
    motivo: ajusteMotivoEnvase.value,
    observaciones: ajusteObservacionesEnvase.value.trim(),
  };

  if (!body.tipo_envase_id || !body.modo || body.cantidad == null || !body.motivo) {
    mensajeAjusteEnvases.textContent =
      "Envase, operacion, cantidad y motivo son obligatorios.";
    return;
  }

  if (!Number.isInteger(body.cantidad) || body.cantidad < 0) {
    mensajeAjusteEnvases.textContent =
      "La cantidad debe ser un numero entero positivo.";
    return;
  }

  if (body.modo !== "definir" && body.cantidad <= 0) {
    mensajeAjusteEnvases.textContent =
      "La cantidad debe ser mayor a 0 para sumar o restar.";
    return;
  }

  ajusteEnvasesEnProceso = true;
  btnGuardarAjusteEnvases.disabled = true;
  btnGuardarAjusteEnvases.textContent = "Guardando...";

  try {
    const response = await fetch(`${API_URL}/importes/ajustes-envases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mensajeAjusteEnvases.textContent =
        data.error || "Error al guardar ajuste.";
      return;
    }

    mostrarMensaje(data.mensaje || "Ajuste de envases realizado correctamente.");
    ajusteEnvasesEnProceso = false;
    cerrarModalAjusteEnvases();

    await cargarInventarioEnvases();
    await cargarAjustesEnvases();
  } catch (error) {
    mensajeAjusteEnvases.textContent = "Error al conectar.";
  } finally {
    ajusteEnvasesEnProceso = false;
    btnGuardarAjusteEnvases.disabled = false;
    btnGuardarAjusteEnvases.textContent = "Guardar ajuste";
  }
}

async function cargarAjustesEnvases() {
  if (!tablaAjustesEnvases) return;

  try {
    const response = await fetch(
      `${API_URL}/importes/ajustes-envases?tienda_id=${tiendaId}&t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar ajustes de envases.");
      return;
    }

    tablaAjustesEnvases.innerHTML = "";

    data.forEach((ajuste) => {
      const tr = document.createElement("tr");
      const diferencia = Number(ajuste.diferencia || 0);

      tr.innerHTML = `
        <td class="p-3 font-semibold">${ajuste.tipo_envase}</td>
        <td class="p-3">${ajuste.cantidad_anterior}</td>
        <td class="p-3">${ajuste.cantidad_nueva}</td>
        <td class="p-3 font-bold ${diferencia < 0 ? "text-red-300" : "text-green-300"}">
          ${diferencia > 0 ? "+" : ""}${diferencia}
        </td>
        <td class="p-3 text-zinc-300">${ajuste.motivo}</td>
        <td class="p-3 text-zinc-400">${ajuste.usuario}</td>
        <td class="p-3 text-zinc-500">${formatearFechaLocal(ajuste.fecha_ajuste)}</td>
      `;

      tablaAjustesEnvases.appendChild(tr);
    });

    if (data.length === 0) {
      tablaAjustesEnvases.innerHTML = `
        <tr>
          <td colspan="7" class="p-5 text-center text-zinc-500">
            No hay ajustes de envases registrados.
          </td>
        </tr>
      `;
    }
  } catch (error) {
    mostrarMensaje("Error al cargar ajustes de envases.");
  }
}

function formatearFechaLocal(fecha) {
  if (!fecha) return "-";

  const fechaTexto = String(fecha);
  const fechaISO = /[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)
    ? fechaTexto
    : fechaTexto.replace(" ", "T") + "Z";
  const date = new Date(fechaISO);

  if (isNaN(date.getTime())) return fechaTexto;

  return date.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
