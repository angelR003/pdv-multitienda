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
const motivoDevolucion = document.getElementById("motivoDevolucion");

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

const esAdmin = usuario.rol === "administrador";


const btnDevolver = document.getElementById("btnDevolver");

const mensaje = document.getElementById("mensaje");

inicializarPantalla();

async function inicializarPantalla() {
  await cargarDetalleVenta();
  await cargarHistorialDevoluciones();
}

async function cargarDetalleVenta() {
  try {
    const response = await fetch(`${API_URL}/ventas/${ventaId}/detalle`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    renderVenta(data.venta);

    console.log("CARGANDO DETALLE VENTA", new Date().toLocaleTimeString());

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
  console.log("DETALLES RECIBIDOS:", detalles);
  detalles.forEach((detalle) => {
    const tr = document.createElement("tr");

    const cantidadVendida = Number(detalle.cantidad || 0);
    const cantidadDevuelta = Number(detalle.cantidad_devuelta || 0);
    const cantidadRestante = Number(detalle.cantidad_restante_devolucion || 0);
    const detalleTipo = detalle.detalle_tipo || "producto";
    const inputDevolucionId = `devolver-${detalleTipo}-${detalle.id}`;


    const tienePromocion = Number(detalle.promocion_id || 0) > 0;
    const descuentoPromocion = Number(detalle.descuento_promocion || 0);
    const precioOriginal = Number(detalle.precio_unitario_original || detalle.precio_unitario || 0);
    const precioFinal = Number(detalle.precio_unitario_final || detalle.precio_unitario || 0);

    const precioUnitario = Number(detalle.precio_unitario || 0);
    const subtotalOriginal = Number(detalle.subtotal || 0);

    const devueltoCompleto = cantidadRestante <= 0;

tr.innerHTML = `
  <td class="p-3 font-semibold">
    <div>${detalle.producto_nombre || "Producto sin nombre"}</div>

    ${
      tienePromocion
        ? `
          <div class="text-xs text-cyan-300 font-bold mt-1">
            Promo: ${detalle.promocion_cantidad_requerida} por $${Number(detalle.promocion_precio || 0).toFixed(2)}
          </div>
        `
        : ""
    }
  </td>

  <td class="p-3">
    <div>
      <strong>Vendido:</strong> ${cantidadVendida} ${detalle.unidad || ""}
    </div>

    <div class="text-xs text-red-400">
      <strong>Devuelto:</strong> ${cantidadDevuelta} ${detalle.unidad || ""}
    </div>

    <div class="text-xs ${devueltoCompleto ? "text-red-400" : "text-green-400"}">
      <strong>Resta:</strong> ${cantidadRestante} ${detalle.unidad || ""}
    </div>
  </td>

  <td class="p-3">
    ${
      tienePromocion
        ? `
          <div class="line-through text-zinc-500">
            $${precioOriginal.toFixed(2)}
          </div>

          <div class="text-cyan-300 font-bold">
            $${precioFinal.toFixed(2)}
          </div>
        `
        : `$${precioFinal.toFixed(2)}`
    }
  </td>

  <td class="p-3 font-bold ${tienePromocion ? "text-cyan-300" : "text-green-400"}">
    $${subtotalOriginal.toFixed(2)}

    ${
      tienePromocion
        ? `
          <div class="text-xs text-zinc-400 font-normal">
            Ahorro: $${descuentoPromocion.toFixed(2)}
          </div>
        `
        : ""
    }
  </td>

  <td class="p-3">
    ${
      devueltoCompleto
        ? `<span class="text-red-400 font-bold">Devuelto completo</span>`
        : `
          <div class="flex items-center gap-2">
            <input
              id="${inputDevolucionId}"
              type="number"
              min="1"
              max="${cantidadRestante}"
              class="w-20 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
              placeholder="Cant."
            />

            <button
              onclick="devolverRenglon(
                ${detalle.id},
                ${detalle.producto_id || "null"},
                ${cantidadRestante},
                ${precioFinal},
                '${detalleTipo}'
              )"
              class="bg-red-500 hover:bg-red-400 text-black px-4 py-2 rounded-xl font-bold"
            >
              Devolver
            </button>
          </div>
        `
    }
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

    mostrarMensaje("Devolución realizada correctamente.");
    motivoDevolucion.value = "";

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

async function cargarHistorialDevoluciones() {
  try {
    const response = await fetch(`${API_URL}/devoluciones/venta/${ventaId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return;
    }

    renderizarHistorialDevoluciones(data);
  } catch (error) {
    console.error(error);
  }
}

async function devolverRenglon(
  detalleId,
  productoId,
  cantidadMaxima,
  precioUnitario,
  detalleTipo = "producto"
) {
  const input = document.getElementById(`devolver-${detalleTipo}-${detalleId}`);

  const cantidad = Number(input.value);

  if (!cantidad || cantidad <= 0) {
    mostrarMensaje("Ingresa una cantidad válida.");
    return;
  }

  if (cantidad > cantidadMaxima) {
    mostrarMensaje(`No puedes devolver más de ${cantidadMaxima}.`);
    return;
  }

const motivo = motivoDevolucion.value.trim();

if (!motivo) {
  mostrarMensaje("El motivo es obligatorio.");
  motivoDevolucion.focus();
  return;
}

  const confirmar = confirm(
    `¿Seguro que quieres devolver ${cantidad} pieza(s)?`
  );

  if (!confirmar) return;

  try {
    const response = await fetch(
      `${API_URL}/devoluciones/renglon`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          venta_id: Number(ventaId),
          venta_detalle_id: detalleId,
          producto_id: productoId,
          servicio_id: detalleTipo === "servicio" ? detalleId : null,
          detalle_tipo: detalleTipo,
          tienda_id: tiendaId,
          usuario_id: usuario.id,
          cantidad,
          precio_unitario: precioUnitario,
          motivo,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.detalle || data.error || "Error al devolver producto.");
      return;
    }

    mostrarMensaje("Producto devuelto correctamente.");

    await cargarDetalleVenta();
    await cargarHistorialDevoluciones();



  } catch (error) {
    console.error(error);
    mostrarMensaje("Error al conectar.");
  }
}


function renderizarHistorialDevoluciones(devoluciones) {
  const contenedor = document.getElementById("historialDevoluciones");

  if (!contenedor) return;

  if (!devoluciones || devoluciones.length === 0) {
    contenedor.innerHTML = `
      <div class="text-sm text-zinc-400 px-3 py-4">
        Esta venta no tiene devoluciones registradas.
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <div class="p-4 space-y-3">
      ${devoluciones.map((dev) => {
        const fecha = dev.fecha_devolucion
          ? formatearFechaLocal(dev.fecha_devolucion)
          : "Sin fecha";

        return `
          <div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <p class="font-black text-white">
                  ${dev.producto_nombre || dev.producto || "Producto sin nombre"}
                </p>

                <p class="text-xs text-zinc-400 mt-1">
                  ${fecha}
                </p>
              </div>

              <div class="text-right">
                <p class="text-green-400 font-black">
                  $${Number(dev.monto_devuelto || 0).toFixed(2)}
                </p>

                <p class="text-xs text-zinc-400">
                  Monto devuelto
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div class="bg-zinc-900 rounded-xl p-3">
                <p class="text-zinc-400 text-xs">Cantidad</p>
                <p class="font-bold">
                  ${dev.cantidad} ${dev.unidad || ""}
                </p>
              </div>

              <div class="bg-zinc-900 rounded-xl p-3">
                <p class="text-zinc-400 text-xs">Usuario</p>
                <p class="font-bold">
                  ${dev.usuario_nombre || "No disponible"}
                </p>
              </div>

              <div class="bg-zinc-900 rounded-xl p-3">
                <p class="text-zinc-400 text-xs">Motivo</p>
                <p class="font-bold text-red-300">
                  ${dev.motivo || "Sin motivo"}
                </p>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


