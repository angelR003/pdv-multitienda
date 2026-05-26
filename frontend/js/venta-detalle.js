const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

const params = new URLSearchParams(window.location.search);

const ventaId = params.get("id");

const folioVenta = document.getElementById("folioVenta");

const infoVenta = document.getElementById("infoVenta");

const tablaDetalles = document.getElementById("tablaDetalles");

const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const esAdmin = usuario.rol === "administrador";

const motivoDevolucion = document.getElementById("motivoDevolucion");

const btnDevolver = document.getElementById("btnDevolver");

const mensaje = document.getElementById("mensaje");

cargarDetalleVenta();

btnDevolver.addEventListener("click", async () => {
  await realizarDevolucion();
});

async function cargarDetalleVenta() {
  try {
    const response = await fetch(`${API_URL}/ventas/${ventaId}/detalle`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    renderVenta(data.venta);

    renderDetalles(data.detalles);
  } catch (error) {
    console.error(error);
  }
}

function renderVenta(venta) {
  folioVenta.textContent = `${venta.folio} • ${formatearFechaLocal(venta.fecha_venta)}`;

  infoVenta.innerHTML = `
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p class="text-zinc-400 text-sm">
        Total
      </p>

      <p class="text-3xl font-black text-green-400 mt-2">
        $${Number(venta.total).toFixed(2)}
      </p>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p class="text-zinc-400 text-sm">
        Método pago
      </p>

      <p class="text-2xl font-bold mt-2">
        ${venta.metodo_pago}
      </p>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p class="text-zinc-400 text-sm">
        Usuario
      </p>

      <p class="text-2xl font-bold mt-2">
        ${venta.usuario}
      </p>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p class="text-zinc-400 text-sm">
        Tienda
      </p>

      <p class="text-2xl font-bold mt-2">
        ${venta.tienda}
      </p>
    </div>
  `;
}

function renderDetalles(detalles) {
  tablaDetalles.innerHTML = "";

  detalles.forEach((detalle) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-semibold">
        ${detalle.producto}
      </td>

      <td class="p-3">
        ${detalle.cantidad} ${detalle.unidad}
      </td>

      <td class="p-3">
        $${Number(detalle.precio_unitario).toFixed(2)}
      </td>

      <td class="p-3 text-green-400 font-bold">
        $${Number(detalle.subtotal).toFixed(2)}
      </td>
    `;

    tablaDetalles.appendChild(tr);
  });
}

async function realizarDevolucion() {
  const motivo = motivoDevolucion.value.trim();

  if (!motivo) {
    mostrarMensaje("El motivo es obligatorio.");
    return;
  }

  const confirmar = confirm("¿Seguro que quieres devolver esta venta?");

  if (!confirmar) return;

  try {
    const response = await fetch(`${API_URL}/devoluciones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        venta_id: Number(ventaId),
        tienda_id: tiendaId,
        usuario_id: usuario.id,
        motivo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al devolver.");
      return;
    }

    motivoDevolucion.value = "";
    mostrarMensaje("Devolución realizada correctamente.");

    btnDevolver.disabled = true;

    btnDevolver.className =
      "mt-5 w-full bg-zinc-700 text-zinc-400 font-black py-4 rounded-xl text-xl cursor-not-allowed";

    btnDevolver.textContent = "Venta devuelta";
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