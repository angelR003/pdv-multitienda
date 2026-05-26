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

const conceptoFiado = document.getElementById("conceptoFiado");
const montoFiado = document.getElementById("montoFiado");
const btnRegistrarFiado = document.getElementById("btnRegistrarFiado");

const montoAbono = document.getElementById("montoAbono");
const observacionesAbono = document.getElementById("observacionesAbono");
const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");

const tablaHistorial = document.getElementById("tablaHistorial");

let clienteSeleccionado = null;
let clientes = [];

btnCrearCliente.addEventListener("click", crearCliente);
btnRegistrarFiado.addEventListener("click", registrarFiado);
btnRegistrarAbono.addEventListener("click", registrarAbono);

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
      const limite = Number(cliente.limite_credito || 0);
      const restante = limite - deuda;

      let borde = "border-green-500/40";
      let estado = "SANO";

      if (limite > 0 && deuda >= limite) {
        borde = "border-red-500";
        estado = "LÍMITE EXCEDIDO";
      } else if (limite > 0 && restante <= 100) {
        borde = "border-yellow-400";
        estado = "CERCA DEL LÍMITE";
      }

      const card = document.createElement("button");

      card.className = `text-left bg-zinc-900 border ${borde} rounded-3xl p-5 hover:-translate-y-1 transition`;
      card.innerHTML = `
        <p class="text-xs font-bold text-zinc-500">${estado}</p>
        <h3 class="text-2xl font-black mt-1">${cliente.nombre_completo}</h3>
        <p class="text-zinc-400">${cliente.apodo || "Sin apodo"}</p>

        <div class="mt-5">
          <p class="text-zinc-400 text-sm">Debe</p>
          <p class="text-3xl font-black text-red-300">$${deuda.toFixed(2)}</p>
        </div>

        <div class="mt-3 text-sm text-zinc-400">
          Límite: $${limite.toFixed(2)}
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
  const limite = Number(cliente.limite_credito || 0);

  detalleCliente.classList.remove("hidden");
  detalleTitulo.textContent = cliente.nombre_completo;

  detalleInfo.textContent =
    `Debe $${deuda.toFixed(2)} de límite $${limite.toFixed(2)}. Tel: ${cliente.telefono || "-"}`;

  cargarHistorial(cliente.id);
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

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="p-3 font-bold ${esAbono ? "text-green-400" : "text-red-400"}">
          ${esAbono ? "ABONO" : "DEUDA"}
        </td>

        <td class="p-3">
          ${item.concepto || "-"}
        </td>

        <td class="p-3 font-black ${esAbono ? "text-green-400" : "text-red-400"}">
          ${esAbono ? "-" : "+"}$${Number(item.monto).toFixed(2)}
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
    alert("Este cliente excede su límite. Se requiere autorización de administrador.");
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
    mostrarMensaje("Monto inválido.");
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

  const fechaISO = fechaTexto.includes("T")
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
    second: "2-digit",
    hour12: false
  });
}