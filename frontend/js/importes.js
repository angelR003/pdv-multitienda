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
const contenedorEnvases = document.getElementById("contenedorEnvases");

let tiposEnvase = [];

let clientesFiado = [];

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

cargarTiposEnvase();
cargarClientesFiado();
cargarImportes();
cargarInventarioEnvases();

async function cargarTiposEnvase() {
  try {
    const response = await fetch(`${API_URL}/importes/tipos-envase`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    tiposEnvase = await response.json();
    renderTiposEnvase();
  } catch (error) {
    mostrarMensaje("Error al cargar tipos de envase.");
  }
}

function renderTiposEnvase() {
  const filtrados = tiposEnvase.filter(
    (tipo) => tipo.categoria === categoria.value,
  );

  tipoEnvase.innerHTML = "";

  filtrados.forEach((tipo) => {
    const option = document.createElement("option");

    option.value = tipo.id;
    option.textContent = `${tipo.nombre} - $${Number(tipo.importe).toFixed(2)}`;

    tipoEnvase.appendChild(option);
  });
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
    !body.cantidad ||
    body.cantidad <= 0
  ) {
    mostrarMensaje("Cliente, envase y cantidad son obligatorios.");
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
    const response = await fetch(`${API_URL}/importes?tienda_id=${tiendaId}`, {
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
  const cantidad = Number(
    prompt(`¿Cuántos envases regresó? Máximo: ${maximo}`),
  );

  if (!cantidad || cantidad <= 0) return;

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
      mostrarMensaje(data.error || "Error al recibir envases.");
      return;
    }

    mostrarMensaje(data.mensaje || "Envases recibidos correctamente.");
    cargarImportes();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

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
    console.table(data);

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar envases.");
      return;
    }

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
