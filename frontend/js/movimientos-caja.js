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

const tipoMovimiento = document.getElementById("tipoMovimiento");
const monto = document.getElementById("monto");
const concepto = document.getElementById("concepto");
const observaciones = document.getElementById("observaciones");
const btnRegistrar = document.getElementById("btnRegistrar");
const mensaje = document.getElementById("mensaje");
const tablaMovimientos = document.getElementById("tablaMovimientos");

btnRegistrar.addEventListener("click", async () => {
  await registrarMovimiento();
});

cargarMovimientos();

async function registrarMovimiento() {
  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    tipo_movimiento: tipoMovimiento.value,
    monto: Number(monto.value),
    concepto: concepto.value.trim(),
    observaciones: observaciones.value.trim(),
  };

  if (!body.monto || body.monto <= 0) {
    mostrarMensaje("Monto inválido.");
    return;
  }

  if (!body.concepto) {
    mostrarMensaje("El concepto es obligatorio.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/movimientos-caja`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response .json();
    

    

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al registrar.");
      return;
    }

    mostrarMensaje("Movimiento registrado correctamente.");

    limpiarFormulario();

    cargarMovimientos();

  } catch (error) {
    console.error("ERROR REAL CAJA:", error);
    mostrarMensaje("Error al conectar.");
  }
}

async function cargarMovimientos() {
  try {
    const response = await fetch(`${API_URL}/movimientos-caja`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar movimientos.");
      return;
    }

    const movimientos = data.filter(
      (item) => Number(item.tienda_id) === tiendaId
    );

    tablaMovimientos.innerHTML = "";

    movimientos.forEach((item) => {
      const tr = document.createElement("tr");

      const color =
        item.tipo_movimiento === "entrada_dinero" ||
        item.tipo_movimiento === "fondo_inicial"
          ? "text-green-400"
          : "text-red-400";

      tr.innerHTML = `
        <td class="p-3 font-semibold">
          ${item.tipo_movimiento}
        </td>

        <td class="p-3 font-bold ${color}">
          $${Number(item.monto).toFixed(2)}
        </td>

        <td class="p-3">
          ${item.concepto}
        </td>

        <td class="p-3 text-zinc-400">
          ${item.usuario}
        </td>

        <td class="p-3 text-zinc-500 text-sm">
          ${formatearFechaLocal(item.fecha_movimiento)}
        </td>
      `;

      tablaMovimientos.appendChild(tr);
    });

    
  } catch (error) {
    console.error("Error real al cargar movimientos:", error);
    mostrarMensaje("Error al cargar movimientos.");
  }
}

function limpiarFormulario() {
  monto.value = "";
  concepto.value = "";
  observaciones.value = "";
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
    hour12: false
  });
}

function normalizarFechaSQLite(fechaTexto) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)) {
    return fechaTexto;
  }

  return fechaTexto.replace(" ", "T") + "Z";
}
