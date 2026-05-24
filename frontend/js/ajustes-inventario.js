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

const producto = document.getElementById("producto");
const cantidadNueva = document.getElementById("cantidadNueva");
const motivo = document.getElementById("motivo");
const observaciones = document.getElementById("observaciones");

const btnAjustar = document.getElementById("btnAjustar");

const mensaje = document.getElementById("mensaje");

const tablaAjustes = document.getElementById("tablaAjustes");

btnAjustar.addEventListener("click", async () => {
  await realizarAjuste();
});

cargarProductos();
cargarAjustes();

async function cargarProductos() {
  try {
    const response = await fetch(`${API_URL}/productos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const productos = await response.json();

    producto.innerHTML = "";

    productos.forEach((item) => {
      const option = document.createElement("option");

      option.value = item.id;

      option.textContent =
        `${item.nombre} (${item.unidad})`;

      producto.appendChild(option);
    });

  } catch (error) {
    mostrarMensaje("Error al cargar productos.");
  }
}

async function realizarAjuste() {
  const body = {
    tienda_id: tiendaId,
    usuario_id: usuario.id,
    producto_id: Number(producto.value),
    cantidad_nueva: Number(cantidadNueva.value),
    motivo: motivo.value.trim(),
    observaciones: observaciones.value.trim(),
  };

  if (!body.producto_id || isNaN(body.cantidad_nueva)) {
    mostrarMensaje("Datos inválidos.");
    return;
  }

  if (!body.motivo) {
    mostrarMensaje("El motivo es obligatorio.");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/ajustes-inventario`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al ajustar.");
      return;
    }

    mostrarMensaje("Ajuste realizado correctamente.");

    cantidadNueva.value = "";
    motivo.value = "";
    observaciones.value = "";

    cargarAjustes();

  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function cargarAjustes() {
  try {
    const response = await fetch(
      `${API_URL}/ajustes-inventario`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const ajustes = await response.json();

    tablaAjustes.innerHTML = "";

    ajustes.forEach((ajuste) => {
      const tr = document.createElement("tr");

      const color =
        ajuste.diferencia < 0
          ? "text-red-400"
          : "text-green-400";

      tr.innerHTML = `
        <td class="p-3 font-semibold">
          ${ajuste.producto}
        </td>

        <td class="p-3">
          ${ajuste.cantidad_anterior}
        </td>

        <td class="p-3">
          ${ajuste.cantidad_nueva}
        </td>

        <td class="p-3 font-bold ${color}">
          ${ajuste.diferencia > 0 ? "+" : ""}
          ${ajuste.diferencia}
        </td>

        <td class="p-3">
          ${ajuste.motivo}
        </td>

        <td class="p-3 text-zinc-400">
          ${ajuste.usuario}
        </td>
      `;

      tablaAjustes.appendChild(tr);
    });

  } catch (error) {
    mostrarMensaje("Error al cargar ajustes.");
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}