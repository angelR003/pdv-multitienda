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

const dineroReal = document.getElementById("dineroReal");
const observaciones = document.getElementById("observaciones");
const btnCorte = document.getElementById("btnCorte");
const mensaje = document.getElementById("mensaje");

const resultadoCorte = document.getElementById("resultadoCorte");

const ventasEfectivo = document.getElementById("ventasEfectivo");
const entradasCaja = document.getElementById("entradasCaja");
const salidasCaja = document.getElementById("salidasCaja");
const dineroEsperado = document.getElementById("dineroEsperado");
const dineroRealResultado = document.getElementById("dineroRealResultado");
const diferencia = document.getElementById("diferencia");
const historialCortes = document.getElementById("historialCortes");
const tablaCortes = document.getElementById("tablaCortes");




btnCorte.addEventListener("click", async () => {
  await realizarCorte();
});

if (usuario.rol === "administrador") {
  historialCortes.classList.remove("hidden");
  cargarCortes();
}

async function realizarCorte() {
  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    dinero_real: Number(dineroReal.value),
    observaciones: observaciones.value.trim(),
  };

  if (body.dinero_real < 0 || isNaN(body.dinero_real)) {
    mostrarMensaje("Dinero real inválido.");
    return;
  }

  try {
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

    mostrarMensaje("Corte realizado correctamente.");

    if (usuario.rol === "administrador") {
  cargarCortes();
}

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

function mostrarResultado(data) {
  resultadoCorte.classList.remove("hidden");

  ventasEfectivo.textContent =
    `$${Number(data.ventas_efectivo).toFixed(2)}`;

  entradasCaja.textContent =
    `$${Number(data.entradas_caja).toFixed(2)}`;

  salidasCaja.textContent =
    `$${Number(data.salidas_caja).toFixed(2)}`;

  dineroEsperado.textContent =
    `$${Number(data.dinero_esperado).toFixed(2)}`;

  dineroRealResultado.textContent =
    `$${Number(data.dinero_real).toFixed(2)}`;

  diferencia.textContent =
    `$${Number(data.diferencia).toFixed(2)}`;

  if (data.diferencia < 0) {
    diferencia.className =
      "text-3xl font-black text-red-400 mt-2";
  } else if (data.diferencia > 0) {
    diferencia.className =
      "text-3xl font-black text-yellow-300 mt-2";
  } else {
    diferencia.className =
      "text-3xl font-black text-green-400 mt-2";
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
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

      const diferencia = Number(corte.diferencia);

      const color =
        diferencia < 0
          ? "text-red-400"
          : diferencia > 0
            ? "text-yellow-300"
            : "text-green-400";

      tr.innerHTML = `
        <td class="p-3 text-zinc-400 text-sm">
          ${corte.fecha_corte}
        </td>

        <td class="p-3">
          ${corte.usuario}
        </td>

        <td class="p-3 text-yellow-300 font-bold">
          $${Number(corte.dinero_esperado).toFixed(2)}
        </td>

        <td class="p-3 text-white font-bold">
          $${Number(corte.dinero_real).toFixed(2)}
        </td>

        <td class="p-3 ${color} font-black">
          $${diferencia.toFixed(2)}
        </td>

        <td class="p-3 text-zinc-400">
          ${corte.observaciones || "-"}
        </td>
      `;

      tablaCortes.appendChild(tr);
    });

  } catch (error) {
    mostrarMensaje("Error al cargar cortes.");
  }
}