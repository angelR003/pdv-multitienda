const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!token || !usuario) {
  window.location.href = "./login.html";
}

if (usuario.rol !== "administrador") {
  window.location.href = "./dashboard.html";
}

const filtroTienda = document.getElementById("filtroTienda");
const fechaInicio = document.getElementById("fechaInicio");
const fechaFin = document.getElementById("fechaFin");
const btnActualizar = document.getElementById("btnActualizar");
const mensaje = document.getElementById("mensaje");

const cardVentasTotal = document.getElementById("cardVentasTotal");
const cardTotalVentas = document.getElementById("cardTotalVentas");
const cardTicketPromedio = document.getElementById("cardTicketPromedio");
const cardDevoluciones = document.getElementById("cardDevoluciones");

const indicadorImportes = document.getElementById("indicadorImportes");
const indicadorEnvases = document.getElementById("indicadorEnvases");
const indicadorMontoImportes = document.getElementById("indicadorMontoImportes");
const indicadorTraspasos = document.getElementById("indicadorTraspasos");

const tablaBajoInventario = document.getElementById("tablaBajoInventario");
const tablaCuentasPorCobrar = document.getElementById("tablaCuentasPorCobrar");
const tablaSaldosAFavor = document.getElementById("tablaSaldosAFavor");
const carteraAlcance = document.getElementById("carteraAlcance");
const carteraTotalPorCobrar = document.getElementById("carteraTotalPorCobrar");
const carteraTotalCreditos = document.getElementById("carteraTotalCreditos");
const carteraEtiquetaNeto = document.getElementById("carteraEtiquetaNeto");
const carteraSaldoNeto = document.getElementById("carteraSaldoNeto");
const leyendaMetodosPago = document.getElementById("leyendaMetodosPago");

const colores = [
  "#22c55e",
  "#38bdf8",
  "#facc15",
  "#fb7185",
  "#a78bfa",
  "#f97316",
  "#14b8a6",
  "#e879f9",
];

btnActualizar.addEventListener("click", cargarReportes);

inicializar();

async function inicializar() {
  establecerFechasIniciales();
  await cargarTiendas();
  await cargarReportes();
}

function establecerFechasIniciales() {
  const hoy = obtenerFechaActualLocal();

  fechaInicio.value = hoy;
  fechaFin.value = formatearFechaInputLocal(hoy);
}

function obtenerFechaActualLocal() {
  return formatearFechaInputLocal(new Date());
}

function formatearFechaInputLocal(fecha) {
  if (typeof fecha === "string") {
    return fecha;
  }

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al cargar datos");
  }

  return data;
}

async function cargarTiendas() {
  try {
    const tiendas = await fetchJson(`${API_URL}/reportes/tiendas`);

    tiendas.forEach((tienda) => {
      const option = document.createElement("option");
      option.value = tienda.id;
      option.textContent = tienda.nombre;
      filtroTienda.appendChild(option);
    });
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

async function cargarReportes() {
  try {
    mostrarMensaje("Cargando reportes...");

    const params = new URLSearchParams();

    if (fechaInicio.value) params.set("fecha_inicio", fechaInicio.value);
    if (fechaFin.value) params.set("fecha_fin", fechaFin.value);
    if (filtroTienda.value) params.set("tienda_id", filtroTienda.value);

    const data = await fetchJson(`${API_URL}/reportes/resumen?${params.toString()}`);

    renderResumen(data.resumen);
    dibujarGraficaVentasDia(data.ventas_por_dia || []);
    dibujarGraficaMetodosPago(data.metodos_pago || []);
    dibujarGraficaTopProductos(data.top_productos || []);
    renderBajoInventario(data.bajo_inventario || []);
    renderCartera(
      data.cartera || {
        alcance: "global",
        descripcion_alcance: "Saldo global actual de clientes.",
        cuentas_por_cobrar: data.fiados_pendientes || [],
        saldos_a_favor: [],
      }
    );

    mostrarMensaje("Reportes actualizados.");
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

function renderResumen(resumen) {
  cardVentasTotal.textContent = formatearDinero(resumen.ventas_total);
  cardTotalVentas.textContent = Number(resumen.total_ventas || 0);
  cardTicketPromedio.textContent = formatearDinero(resumen.ticket_promedio);
  cardDevoluciones.textContent = formatearDinero(resumen.monto_devoluciones);

  indicadorImportes.textContent = Number(resumen.importes_pendientes || 0);
  indicadorEnvases.textContent = Number(resumen.envases_pendientes || 0);
  indicadorMontoImportes.textContent = formatearDinero(resumen.monto_importes_pendientes);
  indicadorTraspasos.textContent = Number(resumen.traspasos_pendientes || 0);
}

function renderBajoInventario(items) {
  tablaBajoInventario.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-3 font-bold">
        ${item.producto}
        <div class="text-xs text-zinc-500">${item.codigo_barras || "Sin código"}</div>
      </td>
      <td class="p-3 text-zinc-300">${item.tienda}</td>
      <td class="p-3 text-red-300 font-bold">${formatearCantidad(item.cantidad_actual, item.unidad)} ${item.unidad}</td>
      <td class="p-3 text-zinc-400">${formatearCantidad(item.cantidad_minima, item.unidad)}</td>
    `;

    tablaBajoInventario.appendChild(tr);
  });

  if (items.length === 0) {
    tablaBajoInventario.innerHTML = `
      <tr>
        <td colspan="4" class="p-6 text-center text-zinc-500">
          Sin productos bajo inventario.
        </td>
      </tr>
    `;
  }
}

function renderCartera(cartera) {
  const cuentasPorCobrar = cartera.cuentas_por_cobrar || [];
  const saldosAFavor = cartera.saldos_a_favor || [];
  const totalPorCobrar = Math.max(
    0,
    Number(
      cartera.total_cuentas_por_cobrar ??
        cuentasPorCobrar.reduce(
          (total, item) =>
            total + Number(item.saldo_deudor ?? item.deuda_total ?? 0),
          0
        )
    ) || 0
  );
  const totalCreditos = Math.max(
    0,
    Number(
      cartera.total_saldos_a_favor ??
        saldosAFavor.reduce(
          (total, item) => total + Number(item.saldo_a_favor || 0),
          0
        )
    ) || 0
  );
  const saldoNeto = Number(
    cartera.saldo_neto_cartera ?? totalPorCobrar - totalCreditos
  ) || 0;

  carteraTotalPorCobrar.textContent = formatearDinero(totalPorCobrar);
  carteraTotalCreditos.textContent = formatearDinero(totalCreditos);
  carteraSaldoNeto.textContent = formatearDinero(Math.abs(saldoNeto));
  carteraAlcance.textContent = cartera.descripcion_alcance ||
    (cartera.alcance === "tienda"
      ? "Deudas y abonos atribuidos a la tienda seleccionada."
      : "Saldo global actual de clientes considerando todas las tiendas.");

  if (saldoNeto < 0) {
    carteraEtiquetaNeto.textContent = "Crédito neto de clientes";
    carteraSaldoNeto.className = "text-3xl font-black text-green-300 mt-2";
  } else {
    carteraEtiquetaNeto.textContent = "Saldo neto por cobrar";
    carteraSaldoNeto.className = "text-3xl font-black text-cyan-300 mt-2";
  }

  renderCuentasPorCobrar(cuentasPorCobrar);
  renderSaldosAFavor(saldosAFavor);
}

function renderCuentasPorCobrar(items) {
  tablaCuentasPorCobrar.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");
    const saldoDeudor = Math.max(
      0,
      Number(item.saldo_deudor ?? item.deuda_total ?? 0) || 0
    );

    tr.innerHTML = `
      <td class="p-3 font-bold">${item.nombre_completo}</td>
      <td class="p-3 text-red-300 font-black">${formatearDinero(saldoDeudor)}</td>
    `;

    tablaCuentasPorCobrar.appendChild(tr);
  });

  if (items.length === 0) {
    tablaCuentasPorCobrar.innerHTML = `
      <tr>
        <td colspan="2" class="p-6 text-center text-zinc-500">
          Sin cuentas por cobrar.
        </td>
      </tr>
    `;
  }
}

function renderSaldosAFavor(items) {
  tablaSaldosAFavor.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");
    const saldoAFavor = Math.max(0, Number(item.saldo_a_favor || 0) || 0);

    tr.innerHTML = `
      <td class="p-3 font-bold">${item.nombre_completo}</td>
      <td class="p-3 text-green-300 font-black">${formatearDinero(saldoAFavor)}</td>
    `;

    tablaSaldosAFavor.appendChild(tr);
  });

  if (items.length === 0) {
    tablaSaldosAFavor.innerHTML = `
      <tr>
        <td colspan="2" class="p-6 text-center text-zinc-500">
          Sin saldos a favor.
        </td>
      </tr>
    `;
  }
}


function limpiarCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * ratio;
  canvas.height = Number(canvas.getAttribute("height")) * ratio;

  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, canvas.height);

  return {
    ctx,
    width: rect.width,
    height: Number(canvas.getAttribute("height")),
  };
}

function dibujarTextoVacio(ctx, width, height, texto) {
  ctx.fillStyle = "#71717a";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(texto, width / 2, height / 2);
}

function dibujarGraficaVentasDia(datos) {
  const canvas = document.getElementById("graficaVentasDia");
  const { ctx, width, height } = limpiarCanvas(canvas);

  if (datos.length === 0) {
    dibujarTextoVacio(ctx, width, height, "Sin ventas en el periodo");
    return;
  }

  const datosGrafica = agruparVentasParaGrafica(datos);
  const margenIzquierdo = 46;
  const margenDerecho = 18;
  const margenSuperior = 20;
  const margenInferior = datosGrafica.length > 18 ? 44 : 34;
  const areaAncho = width - margenIzquierdo - margenDerecho;
  const areaAlto = height - margenSuperior - margenInferior;
  const maximo = Math.max(...datosGrafica.map((item) => Number(item.total || 0)), 1);
  const anchoSlot = areaAncho / datosGrafica.length;
  const anchoBarra = Math.max(Math.min(anchoSlot * 0.72, 34), 3);
  const saltoEtiqueta = Math.max(1, Math.ceil(datosGrafica.length / 12));

  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#71717a";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i < 4; i++) {
    const y = margenSuperior + (areaAlto / 3) * i;
    const valorLinea = maximo - (maximo / 3) * i;
    ctx.beginPath();
    ctx.moveTo(margenIzquierdo, y);
    ctx.lineTo(width - margenDerecho, y);
    ctx.stroke();
    ctx.fillText(formatearDineroCompacto(valorLinea), margenIzquierdo - 8, y + 3);
  }

  datosGrafica.forEach((item, index) => {
    const valor = Number(item.total || 0);
    const alto = Math.max((valor / maximo) * areaAlto, valor > 0 ? 2 : 0);
    const centroX = margenIzquierdo + index * anchoSlot + anchoSlot / 2;
    const x = centroX - anchoBarra / 2;
    const y = margenSuperior + areaAlto - alto;

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x, y, anchoBarra, alto);

    if (
      index % saltoEtiqueta === 0 ||
      index === datosGrafica.length - 1
    ) {
      ctx.save();
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "10px sans-serif";
      ctx.textAlign = datosGrafica.length > 18 ? "right" : "center";
      if (datosGrafica.length > 18) {
        ctx.translate(centroX + 3, height - 12);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(item.etiqueta, 0, 0);
      } else {
        ctx.fillText(item.etiqueta, centroX, height - 10);
      }
      ctx.restore();
    }
  });

  if (datosGrafica.modo && datosGrafica.modo !== "dia") {
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Vista agrupada por ${datosGrafica.modo}`, margenIzquierdo, 12);
  }
}

function dibujarGraficaMetodosPago(datos) {
  const canvas = document.getElementById("graficaMetodosPago");
  const { ctx, width, height } = limpiarCanvas(canvas);

  leyendaMetodosPago.innerHTML = "";

  const total = datos.reduce((sum, item) => sum + Number(item.total || 0), 0);

  if (!total) {
    dibujarTextoVacio(ctx, width, height, "Sin métodos de pago");
    return;
  }

  const centroX = width / 2;
  const centroY = height / 2;
  const radio = Math.min(width, height) / 2 - 18;

  let anguloInicio = -Math.PI / 2;

  datos.forEach((item, index) => {
    const valor = Number(item.total || 0);
    const angulo = (valor / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(centroX, centroY);
    ctx.arc(centroX, centroY, radio, anguloInicio, anguloInicio + angulo);
    ctx.closePath();
    ctx.fillStyle = colores[index % colores.length];
    ctx.fill();

    anguloInicio += angulo;

    const div = document.createElement("div");
    div.className = "flex items-center justify-between gap-3 text-sm";

    div.innerHTML = `
      <span class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background:${colores[index % colores.length]}"></span>
        ${item.metodo_pago}
      </span>
      <span class="font-bold">${formatearDinero(item.total)}</span>
    `;

    leyendaMetodosPago.appendChild(div);
  });

  ctx.beginPath();
  ctx.arc(centroX, centroY, radio * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#18181b";
  ctx.fill();

  ctx.fillStyle = "#f4f4f5";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(formatearDinero(total), centroX, centroY + 6);
}

function dibujarGraficaTopProductos(datos) {
  const canvas = document.getElementById("graficaTopProductos");
  const { ctx, width, height } = limpiarCanvas(canvas);

  if (datos.length === 0) {
    dibujarTextoVacio(ctx, width, height, "Sin productos vendidos");
    return;
  }

  const maximo = Math.max(...datos.map((item) => Number(item.cantidad_total || 0)), 1);
  const margenNombre = Math.min(210, Math.max(140, width * 0.34));
  const altoFila = Math.min(30, (height - 20) / datos.length);

  datos.forEach((item, index) => {
    const y = 12 + index * altoFila;
    const cantidad = Number(item.cantidad_total || 0);
    const anchoMaximo = Math.max(width - margenNombre - 70, 80);
    const ancho = (anchoMaximo * cantidad) / maximo;

    ctx.fillStyle = "#d4d4d8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(recortarTexto(item.nombre_producto, Math.floor(margenNombre / 8)), 8, y + 15);

    ctx.fillStyle = colores[index % colores.length];
    ctx.fillRect(margenNombre, y, Math.max(ancho, 4), altoFila - 8);

    ctx.fillStyle = "#f4f4f5";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(
      formatearCantidad(cantidad, item.unidad),
      margenNombre + ancho + 8,
      y + 15
    );
  });
}

function agruparVentasParaGrafica(datos) {
  if (datos.length <= 45) {
    const resultado = datos.map((item) => ({
      etiqueta: String(item.fecha || "").slice(5),
      total: Number(item.total || 0),
    }));
    resultado.modo = "dia";
    return resultado;
  }

  const modo = datos.length <= 180 ? "semana" : "mes";
  const grupos = new Map();

  datos.forEach((item) => {
    const fecha = String(item.fecha || "");
    const clave = modo === "semana"
      ? obtenerClaveSemana(fecha)
      : fecha.slice(0, 7);

    const previo = grupos.get(clave) || {
      etiqueta: modo === "semana" ? clave.replace("-", " S") : clave.slice(2),
      total: 0,
    };

    previo.total += Number(item.total || 0);
    grupos.set(clave, previo);
  });

  const resultado = Array.from(grupos.values());
  resultado.modo = modo;
  return resultado;
}

function obtenerClaveSemana(fechaTexto) {
  const fecha = new Date(`${fechaTexto}T12:00:00`);

  if (isNaN(fecha.getTime())) {
    return fechaTexto.slice(0, 7);
  }

  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  const semana = Math.floor((dias + inicio.getDay()) / 7) + 1;

  return `${fecha.getFullYear()}-${String(semana).padStart(2, "0")}`;
}

function formatearDineroCompacto(valor) {
  const numero = Number(valor || 0);

  if (Math.abs(numero) >= 1000) {
    return `$${(numero / 1000).toFixed(numero >= 10000 ? 0 : 1)}k`;
  }

  return `$${numero.toFixed(0)}`;
}

function formatearDinero(valor) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

function formatearCantidad(valor, unidad) {
  const numero = Number(valor || 0);

  if (unidad === "pieza") {
    return String(Math.round(numero));
  }

  return numero
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

function recortarTexto(texto, maximo) {
  const limpio = String(texto || "");

  if (limpio.length <= maximo) {
    return limpio;
  }

  return `${limpio.slice(0, maximo - 1)}…`;
}

window.addEventListener("resize", () => {
  cargarReportes();
});
