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

const nombreCompleto = document.getElementById("nombreCompleto");
const apodo = document.getElementById("apodo");
const telefono = document.getElementById("telefono");
const limiteCredito = document.getElementById("limiteCredito");
const btnCrearCliente = document.getElementById("btnCrearCliente");
const mensaje = document.getElementById("mensaje");

const contenedorClientes = document.getElementById("contenedorClientes");
const detalleCliente = document.getElementById("detalleCliente");
const detalleTitulo = document.getElementById("detalleTitulo");
const detalleInfo = document.getElementById("detalleInfo");
const btnEditarCliente = document.getElementById("btnEditarCliente");
const btnDesactivarCliente = document.getElementById("btnDesactivarCliente");

const conceptoFiado = document.getElementById("conceptoFiado");
const montoFiado = document.getElementById("montoFiado");
const btnRegistrarFiado = document.getElementById("btnRegistrarFiado");

const montoAbono = document.getElementById("montoAbono");
const observacionesAbono = document.getElementById("observacionesAbono");
const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");

const tablaHistorial = document.getElementById("tablaHistorial");
const modalEditarCliente = document.getElementById("modalEditarCliente");
const editarNombreCompleto = document.getElementById("editarNombreCompleto");
const editarApodo = document.getElementById("editarApodo");
const editarTelefono = document.getElementById("editarTelefono");
const editarLimiteCredito = document.getElementById("editarLimiteCredito");
const mensajeEditarCliente = document.getElementById("mensajeEditarCliente");
const btnCancelarEditarCliente = document.getElementById("btnCancelarEditarCliente");
const btnGuardarEditarCliente = document.getElementById("btnGuardarEditarCliente");

let clienteSeleccionado = null;
let clientes = [];
let edicionClienteEnProceso = false;

btnCrearCliente.addEventListener("click", crearCliente);
btnRegistrarFiado.addEventListener("click", registrarFiado);
btnRegistrarAbono.addEventListener("click", registrarAbono);
btnEditarCliente?.addEventListener("click", abrirModalEditarCliente);
btnDesactivarCliente?.addEventListener("click", desactivarClienteSeleccionado);
btnCancelarEditarCliente?.addEventListener("click", cerrarModalEditarCliente);
btnGuardarEditarCliente?.addEventListener("click", guardarEdicionCliente);

cargarClientes();

async function cargarClientes() {
  try {
    const response = await fetch(`${API_URL}/fiados/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    clientes = await response.json();
    contenedorClientes.innerHTML = "";

    clientes.forEach((cliente) => {
      const deuda = Number(cliente.deuda_total || 0);
      const envasesPendientes = Number(cliente.envases_pendientes || 0);
      const envasesHistorial = Number(cliente.envases_historial || 0);
      const limite = Number(cliente.limite_credito || 0);
      const restante = limite - deuda;

      let borde = "border-green-500/40";
      let estado = "SANO";

      if (envasesPendientes > 0 || envasesHistorial > 0) {
        borde = "border-yellow-400";
        estado = "ENVASES";
      }

      if (limite > 0 && deuda >= limite) {
        borde = "border-red-500";
        estado = "LIMITE EXCEDIDO";
      } else if (limite > 0 && restante <= 100) {
        borde = "border-yellow-400";
        estado = "CERCA DEL LIMITE";
      }

      const card = document.createElement("button");

      card.className = `text-left bg-zinc-900 border ${borde} rounded-3xl p-5 hover:-translate-y-1 transition`;
      card.innerHTML = `
        <p class="text-xs font-bold text-zinc-500">${estado}</p>
        <h3 class="text-2xl font-black mt-1">${cliente.nombre_completo}</h3>
        <p class="text-zinc-400">${cliente.apodo || "Sin apodo"}</p>

        <div class="mt-5">
          <p class="text-zinc-400 text-sm">Debe dinero</p>
          <p class="text-3xl font-black text-red-300">$${deuda.toFixed(2)}</p>
        </div>

        ${
          envasesPendientes > 0 || envasesHistorial > 0
            ? `
              <div class="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
                <p class="text-xs font-bold text-yellow-300">Envases</p>
                <p class="text-sm text-zinc-300">${envasesPendientes} pendiente(s)</p>
              </div>
            `
            : ""
        }

        <div class="mt-3 text-sm text-zinc-400">
          Limite: $${limite.toFixed(2)}
        </div>
      `;

      card.addEventListener("click", () => seleccionarCliente(cliente));
      contenedorClientes.appendChild(card);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar clientes.");
  }
}

async function crearCliente() {
  const body = {
    nombre_completo: nombreCompleto.value.trim(),
    apodo: apodo.value.trim(),
    telefono: telefono.value.trim(),
    limite_credito: Number(limiteCredito.value) || 0,
  };

  if (!body.nombre_completo) {
    mostrarMensaje("El nombre completo es obligatorio.");
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
      mostrarMensaje(data.error || "Error al crear cliente.");
      return;
    }

    nombreCompleto.value = "";
    apodo.value = "";
    telefono.value = "";
    limiteCredito.value = "";

    mostrarMensaje("Cliente creado correctamente.");
    cargarClientes();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function seleccionarCliente(cliente) {
  clienteSeleccionado = cliente;

  const deuda = Number(cliente.deuda_total || 0);
  const envasesPendientes = Number(cliente.envases_pendientes || 0);
  const limite = Number(cliente.limite_credito || 0);

  detalleCliente.classList.remove("hidden");
  detalleTitulo.textContent = cliente.nombre_completo;

  detalleInfo.textContent =
    `Debe dinero $${deuda.toFixed(2)} de limite $${limite.toFixed(2)}. Envases pendientes: ${envasesPendientes}. Tel: ${cliente.telefono || "-"}`;

  cargarHistorial(cliente.id);
}

function abrirModalEditarCliente() {
  if (!clienteSeleccionado) return;

  editarNombreCompleto.value = clienteSeleccionado.nombre_completo || "";
  editarApodo.value = clienteSeleccionado.apodo || "";
  editarTelefono.value = clienteSeleccionado.telefono || "";
  editarLimiteCredito.value = Number(clienteSeleccionado.limite_credito || 0);
  mensajeEditarCliente.textContent = "";
  modalEditarCliente.classList.remove("hidden");

  setTimeout(() => {
    editarNombreCompleto.focus();
  }, 100);
}

function cerrarModalEditarCliente() {
  if (edicionClienteEnProceso) return;

  modalEditarCliente.classList.add("hidden");
}

async function guardarEdicionCliente() {
  if (edicionClienteEnProceso || !clienteSeleccionado) return;

  const body = {
    nombre_completo: editarNombreCompleto.value.trim(),
    apodo: editarApodo.value.trim(),
    telefono: editarTelefono.value.trim(),
    limite_credito: Number(editarLimiteCredito.value) || 0,
  };

  if (!body.nombre_completo) {
    mensajeEditarCliente.textContent = "El nombre completo es obligatorio.";
    return;
  }

  edicionClienteEnProceso = true;
  btnGuardarEditarCliente.disabled = true;
  btnGuardarEditarCliente.textContent = "Guardando...";

  try {
    const response = await fetch(`${API_URL}/fiados/clientes/${clienteSeleccionado.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mensajeEditarCliente.textContent = data.error || "Error al actualizar cliente.";
      return;
    }

    mostrarMensaje(data.mensaje || "Cliente actualizado correctamente.");
    edicionClienteEnProceso = false;
    cerrarModalEditarCliente();

    await cargarClientes();
    const actualizado = clientes.find(
      (cliente) => Number(cliente.id) === Number(clienteSeleccionado.id)
    );

    if (actualizado) {
      seleccionarCliente(actualizado);
    }
  } catch (error) {
    mensajeEditarCliente.textContent = "Error al conectar.";
  } finally {
    edicionClienteEnProceso = false;
    btnGuardarEditarCliente.disabled = false;
    btnGuardarEditarCliente.textContent = "Guardar cambios";
  }
}

async function desactivarClienteSeleccionado() {
  if (!clienteSeleccionado) return;

  const confirmar = confirm(
    `Desactivar a ${clienteSeleccionado.nombre_completo}? Su historial se conservara.`
  );

  if (!confirmar) return;

  try {
    const response = await fetch(
      `${API_URL}/fiados/clientes/${clienteSeleccionado.id}/desactivar`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al desactivar cliente.");
      return;
    }

    mostrarMensaje(data.mensaje || "Cliente desactivado correctamente.");
    clienteSeleccionado = null;
    detalleCliente.classList.add("hidden");
    await cargarClientes();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function cargarHistorial(clienteId) {
  try {
    const response = await fetch(`${API_URL}/fiados/historial/${clienteId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    tablaHistorial.innerHTML = "";

    data.forEach((item) => {
      const esAbono = item.tipo === "abono";
      const esEnvase =
        item.tipo === "envase_prestado" || item.tipo === "envase_devuelto";
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="p-3 font-bold ${esEnvase ? "text-yellow-300" : esAbono ? "text-green-400" : "text-red-400"}">
          ${obtenerEtiquetaHistorial(item.tipo)}
        </td>

        <td class="p-3">
          ${item.concepto || "-"}
        </td>

        <td class="p-3 font-black ${esEnvase ? "text-zinc-500" : esAbono ? "text-green-400" : "text-red-400"}">
          ${esEnvase ? "No monetario" : `${esAbono ? "-" : "+"}$${Number(item.monto).toFixed(2)}`}
        </td>

        <td class="p-3 text-zinc-400">
          ${item.usuario || "-"}
        </td>

        <td class="p-3 text-zinc-500 text-sm">
          ${formatearFechaLocal(item.fecha)}
        </td>
      `;

      tablaHistorial.appendChild(tr);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar historial.");
  }
}

function obtenerEtiquetaHistorial(tipo) {
  if (tipo === "abono") return "ABONO";
  if (tipo === "envase_prestado") return "ENVASE PRESTADO";
  if (tipo === "envase_devuelto") return "ENVASE DEVUELTO";

  return "DEUDA";
}

async function registrarFiado() {
  if (!clienteSeleccionado) {
    mostrarMensaje("Selecciona un cliente.");
    return;
  }

  const monto = Number(montoFiado.value);
  const concepto = conceptoFiado.value.trim();

  if (!concepto || !monto || monto <= 0) {
    mostrarMensaje("Concepto y monto son obligatorios.");
    return;
  }

  const deudaActual = Number(clienteSeleccionado.deuda_total || 0);
  const limite = Number(clienteSeleccionado.limite_credito || 0);

  if (limite > 0 && deudaActual + monto > limite && usuario.rol !== "administrador") {
    alert("Este cliente excede su limite. Se requiere autorizacion de administrador.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/fiados/registrar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        tienda_id: tiendaId,
        concepto,
        monto,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar fiado.");
      return;
    }

    conceptoFiado.value = "";
    montoFiado.value = "";

    mostrarMensaje("Fiado registrado.");
    await cargarClientes();

    const actualizado = clientes.find((c) => c.id === clienteSeleccionado.id);
    if (actualizado) seleccionarCliente(actualizado);
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function registrarAbono() {
  if (!clienteSeleccionado) {
    mostrarMensaje("Selecciona un cliente.");
    return;
  }

  const monto = Number(montoAbono.value);

  if (!monto || monto <= 0) {
    mostrarMensaje("Monto invalido.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/fiados/abono`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cliente_id: clienteSeleccionado.id,
        usuario_id: usuario.id,
        tienda_id: tiendaId,
        monto,
        observaciones: observacionesAbono.value.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar abono.");
      return;
    }

    montoAbono.value = "";
    observacionesAbono.value = "";

    mostrarMensaje("Abono registrado.");
    await cargarClientes();

    const actualizado = clientes.find((c) => c.id === clienteSeleccionado.id);
    if (actualizado) seleccionarCliente(actualizado);
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
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

function normalizarFechaSQLite(fechaTexto) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)) {
    return fechaTexto;
  }

  return fechaTexto.replace(" ", "T") + "Z";
}
