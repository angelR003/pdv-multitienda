const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaId = Number(localStorage.getItem("tienda_id"));

if (!tiendaId) {
  window.location.href = "./config-terminal.html";
}

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const dineroReal = document.getElementById("dineroReal");
const observaciones = document.getElementById("observaciones");
const btnCorte = document.getElementById("btnCorte");
const btnActualizarResumen = document.getElementById("btnActualizarResumen");
const mensaje = document.getElementById("mensaje");

const rangoCorte = document.getElementById("rangoCorte");
const ventasEfectivoBrutas = document.getElementById("ventasEfectivoBrutas");
const ventasEfectivoConteo = document.getElementById("ventasEfectivoConteo");
const devolucionesEfectivo = document.getElementById("devolucionesEfectivo");
const devolucionesEfectivoConteo = document.getElementById("devolucionesEfectivoConteo");
const entradasCaja = document.getElementById("entradasCaja");
const salidasCaja = document.getElementById("salidasCaja");
const dineroEsperado = document.getElementById("dineroEsperado");
const detalleMovimientosCaja = document.getElementById("detalleMovimientosCaja");
const detalleDevolucionesCaja = document.getElementById("detalleDevolucionesCaja");
const resumenCorteSection = document.getElementById("resumenCorteSection");
const detalleCorteSection = document.getElementById("detalleCorteSection");
const avisoConteoCiego = document.getElementById("avisoConteoCiego");

const previewDiferencia = document.getElementById("previewDiferencia");
const previewDiferenciaTexto = document.getElementById("previewDiferenciaTexto");
const resultadoCorte = document.getElementById("resultadoCorte");
const resultadoTitulo = document.getElementById("resultadoTitulo");
const dineroEsperadoResultado = document.getElementById("dineroEsperadoResultado");
const dineroRealResultado = document.getElementById("dineroRealResultado");
const diferencia = document.getElementById("diferencia");
const historialCortes = document.getElementById("historialCortes");
const tablaCortes = document.getElementById("tablaCortes");

let resumenActual = null;
const esAdmin = usuario.rol === "administrador";

btnCorte.addEventListener("click", realizarCorte);
btnActualizarResumen?.addEventListener("click", cargarResumenCorte);
dineroReal.addEventListener("input", actualizarPreviewDiferencia);

if (esAdmin) {
  historialCortes.classList.remove("hidden");
  cargarCortes();
  cargarResumenCorte();
} else {
  activarConteoCiego();
}

async function cargarResumenCorte() {
  if (!esAdmin) {
    return;
  }

  try {
    mostrarMensaje("Calculando corte pendiente...");

    const response = await fetch(
      `${API_URL}/cortes/resumen?tienda_id=${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al calcular resumen.");
      return;
    }

    resumenActual = data;
    renderResumenCorte(data);
    actualizarPreviewDiferencia();
    mostrarMensaje("Resumen actualizado.");
  } catch (error) {
    console.error("ERROR RESUMEN CORTE:", error);
    mostrarMensaje("Error al conectar.");
  }
}

async function realizarCorte() {
  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    dinero_real: Number(dineroReal.value),
    observaciones: observaciones.value.trim(),
  };

  if (body.dinero_real < 0 || isNaN(body.dinero_real)) {
    mostrarMensaje("Ingresa el efectivo contado.");
    return;
  }

  const confirmar = confirm(
    "Se registrara el corte de caja con el efectivo contado.\n\n" +
      "Despues de aceptar se mostrara si hubo faltante, sobrante o si la caja cuadro.\n\n" +
      "¿Deseas cerrar caja ahora?"
  );

  if (!confirmar) {
    return;
  }

  try {
    btnCorte.disabled = true;
    btnCorte.classList.add("opacity-60", "cursor-not-allowed");

    const response = await fetch(`${API_URL}/cortes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al realizar corte.");
      return;
    }

    mostrarResultado(data);
    dineroReal.value = "";
    observaciones.value = "";

    await cargarResumenCorte();
    mostrarMensaje("Corte registrado correctamente.");

    if (esAdmin) {
      cargarCortes();
    }
  } catch (error) {
    console.error("ERROR CORTE:", error);
    mostrarMensaje("Error al conectar.");
  } finally {
    btnCorte.disabled = false;
    btnCorte.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function renderResumenCorte(data) {
  rangoCorte.textContent = `Desde el ultimo corte: ${formatearFechaLocal(data.desde)}`;
  ventasEfectivoBrutas.textContent = formatearDinero(data.ventas_efectivo_brutas);
  ventasEfectivoConteo.textContent =
    `${Number(data.ventas_efectivo_operaciones || 0)} operaciones en efectivo`;
  devolucionesEfectivo.textContent = `-${formatearDinero(data.devoluciones_efectivo)}`;
  devolucionesEfectivoConteo.textContent =
    `${Number(data.devoluciones_efectivo_operaciones || 0)} devoluciones`;
  entradasCaja.textContent = `+${formatearDinero(data.entradas_caja)}`;
  salidasCaja.textContent = `-${formatearDinero(data.salidas_caja)}`;
  dineroEsperado.textContent = formatearDinero(data.dinero_esperado);

  renderDetalleMovimientos(data.movimientos || []);
  renderDetalleDevoluciones(data.devoluciones || []);
}

function renderDetalleMovimientos(movimientos) {
  if (!movimientos.length) {
    detalleMovimientosCaja.innerHTML = `
      <p class="text-sm text-zinc-500">No hay entradas ni salidas de caja desde el ultimo corte.</p>
    `;
    return;
  }

  detalleMovimientosCaja.innerHTML = `
    <table class="w-full text-left text-sm">
      <thead class="text-zinc-400">
        <tr>
          <th class="py-2 pr-3">Tipo</th>
          <th class="py-2 pr-3">Monto</th>
          <th class="py-2 pr-3">Concepto</th>
          <th class="py-2 pr-3">Usuario</th>
          <th class="py-2">Fecha</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800">
        ${movimientos.map(renderMovimientoCaja).join("")}
      </tbody>
    </table>
  `;
}

function renderMovimientoCaja(item) {
  const esEntrada = ["fondo_inicial", "entrada_dinero", "ajuste"].includes(
    item.tipo_movimiento
  );
  const color = esEntrada ? "text-green-400" : "text-red-400";
  const signo = esEntrada ? "+" : "-";

  return `
    <tr>
      <td class="py-3 pr-3 font-bold">${formatearTipoMovimiento(item.tipo_movimiento)}</td>
      <td class="py-3 pr-3 ${color} font-black">${signo}${formatearDinero(item.monto)}</td>
      <td class="py-3 pr-3 text-zinc-300">${item.concepto || "-"}</td>
      <td class="py-3 pr-3 text-zinc-400">${item.usuario || "-"}</td>
      <td class="py-3 text-zinc-500">${formatearFechaLocal(item.fecha_movimiento)}</td>
    </tr>
  `;
}

function renderDetalleDevoluciones(devoluciones) {
  if (!devoluciones.length) {
    detalleDevolucionesCaja.innerHTML = `
      <p class="text-sm text-zinc-500">No hay devoluciones en efectivo desde el ultimo corte.</p>
    `;
    return;
  }

  detalleDevolucionesCaja.innerHTML = `
    <table class="w-full text-left text-sm">
      <thead class="text-zinc-400">
        <tr>
          <th class="py-2 pr-3">Monto</th>
          <th class="py-2 pr-3">Motivo</th>
          <th class="py-2 pr-3">Usuario</th>
          <th class="py-2">Fecha</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800">
        ${devoluciones.map(renderDevolucionCaja).join("")}
      </tbody>
    </table>
  `;
}

function renderDevolucionCaja(item) {
  return `
    <tr>
      <td class="py-3 pr-3 text-red-400 font-black">-${formatearDinero(item.total_devuelto)}</td>
      <td class="py-3 pr-3 text-zinc-300">${item.motivo || "-"}</td>
      <td class="py-3 pr-3 text-zinc-400">${item.usuario || "-"}</td>
      <td class="py-3 text-zinc-500">${formatearFechaLocal(item.fecha_devolucion)}</td>
    </tr>
  `;
}

function actualizarPreviewDiferencia() {
  if (!esAdmin) {
    previewDiferencia.className =
      "mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5";
    previewDiferenciaTexto.className = "mt-2 text-2xl font-black text-cyan-300";
    previewDiferenciaTexto.textContent =
      dineroReal.value === ""
        ? "Escribe el efectivo contado."
        : "Listo para cerrar caja.";
    return;
  }

  if (!resumenActual || dineroReal.value === "") {
    previewDiferencia.className =
      "mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5";
    previewDiferenciaTexto.className = "mt-2 text-2xl font-black text-zinc-300";
    previewDiferenciaTexto.textContent = "Escribe el efectivo contado.";
    return;
  }

  const contado = Number(dineroReal.value);

  if (isNaN(contado) || contado < 0) {
    previewDiferenciaTexto.textContent = "Monto invalido.";
    previewDiferenciaTexto.className = "mt-2 text-2xl font-black text-red-400";
    return;
  }

  const diferenciaActual = redondear(contado - Number(resumenActual.dinero_esperado || 0));
  const estado = obtenerEstadoDiferencia(diferenciaActual);

  previewDiferencia.className =
    `mt-5 rounded-2xl border ${estado.borde} bg-zinc-950 p-5`;
  previewDiferenciaTexto.className = `mt-2 text-2xl font-black ${estado.color}`;
  previewDiferenciaTexto.textContent = `${estado.texto}: ${formatearDinero(Math.abs(diferenciaActual))}`;
}

function mostrarResultado(data) {
  resultadoCorte.classList.remove("hidden");

  const estado = obtenerEstadoDiferencia(Number(data.diferencia));
  resultadoTitulo.textContent = estado.texto;
  resultadoTitulo.className = `text-3xl font-black mt-1 ${estado.color}`;

  dineroEsperadoResultado.textContent = formatearDinero(data.dinero_esperado);
  dineroRealResultado.textContent = formatearDinero(data.dinero_real);
  diferencia.textContent = formatearDinero(Math.abs(Number(data.diferencia)));
  diferencia.className = `text-2xl font-black mt-1 ${estado.color}`;
}

function activarConteoCiego() {
  resumenCorteSection?.classList.add("hidden");
  detalleCorteSection?.classList.add("hidden");
  btnActualizarResumen?.classList.add("hidden");
  avisoConteoCiego?.classList.remove("hidden");
  previewDiferenciaTexto.textContent = "Escribe el efectivo contado.";
}

async function cargarCortes() {
  try {
    const response = await fetch(
      `${API_URL}/cortes?tienda_id=${tiendaId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar cortes.");
      return;
    }

    tablaCortes.innerHTML = "";

    data.forEach((corte) => {
      const tr = document.createElement("tr");
      const diff = Number(corte.diferencia);
      const estado = obtenerEstadoDiferencia(diff);

      tr.innerHTML = `
        <td class="p-3 text-zinc-400 text-sm">${formatearFechaLocal(corte.fecha_corte)}</td>
        <td class="p-3">${corte.usuario}</td>
        <td class="p-3 text-yellow-300 font-bold">${formatearDinero(corte.dinero_esperado)}</td>
        <td class="p-3 text-white font-bold">${formatearDinero(corte.dinero_real)}</td>
        <td class="p-3 ${estado.color} font-black">${estado.texto} ${formatearDinero(Math.abs(diff))}</td>
        <td class="p-3 text-zinc-400">${corte.observaciones || "-"}</td>
      `;

      tablaCortes.appendChild(tr);
    });
  } catch (error) {
    console.error("ERROR HISTORIAL CORTES:", error);
    mostrarMensaje("Error al cargar cortes.");
  }
}

function obtenerEstadoDiferencia(valor) {
  if (valor < 0) {
    return {
      texto: "Faltante",
      color: "text-red-400",
      borde: "border-red-500",
    };
  }

  if (valor > 0) {
    return {
      texto: "Sobrante",
      color: "text-yellow-300",
      borde: "border-yellow-400",
    };
  }

  return {
    texto: "Caja correcta",
    color: "text-green-400",
    borde: "border-green-500",
  };
}

function formatearTipoMovimiento(tipo) {
  const nombres = {
    fondo_inicial: "Fondo inicial",
    entrada_dinero: "Entrada de dinero",
    salida_dinero: "Salida de dinero",
    pago_proveedor: "Pago a proveedor",
    retiro: "Retiro",
    ajuste: "Ajuste",
  };

  return nombres[tipo] || tipo;
}

function formatearDinero(valor) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

function redondear(valor) {
  return Math.round(Number(valor || 0) * 100) / 100;
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
