const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");
const usuarioActual = JSON.parse(localStorage.getItem("usuario"));
let usuarioEditandoId = null;

if (!token || !usuarioActual) {
  window.location.href = "./login.html";
}

if (usuarioActual.rol !== "administrador") {
  window.location.href = "./dashboard.html";
}

const nombre = document.getElementById("nombre");
const username = document.getElementById("username");
const password = document.getElementById("password");
const rol = document.getElementById("rol");
const tiendaId = document.getElementById("tiendaId");
const btnCrear = document.getElementById("btnCrear");
const mensaje = document.getElementById("mensaje");
const tablaUsuarios = document.getElementById("tablaUsuarios");
const tablaAccesos = document.getElementById("tablaAccesos");
const tituloAccesos = document.getElementById("tituloAccesos");
const modalPassword = document.getElementById("modalPassword");
const nuevaPasswordInput = document.getElementById("nuevaPasswordInput");
const mensajePassword = document.getElementById("mensajePassword");
const btnConfirmarPassword = document.getElementById("btnConfirmarPassword");
const btnCancelarPassword = document.getElementById("btnCancelarPassword");

let usuarioPasswordId = null;

btnCrear.addEventListener("click", crearUsuario);
btnCancelarPassword.addEventListener("click", cerrarModalPassword);

btnConfirmarPassword.addEventListener("click", guardarNuevaPassword);

cargarUsuarios();

async function crearUsuario() {
  const body = {
    nombre: nombre.value.trim(),
    username: username.value.trim(),
    password: password.value.trim(),
    rol: rol.value,
    tienda_id: Number(tiendaId.value),
  };

  if (
    !body.nombre ||
    !body.username ||
    !body.tienda_id ||
    (!usuarioEditandoId && !body.password)
  ) {
    mostrarMensaje("Todos los campos son obligatorios.");
    return;
  }
  try {
    const url = usuarioEditandoId
      ? `${API_URL}/usuarios/${usuarioEditandoId}`
      : `${API_URL}/usuarios`;

    const method = usuarioEditandoId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al crear usuario.");
      return;
    }

    mostrarMensaje(
      usuarioEditandoId
        ? "Usuario actualizado correctamente."
        : "Usuario creado correctamente.",
    );

    usuarioEditandoId = null;

    btnCrear.textContent = "Crear usuario";
    limpiarFormulario();
    cargarUsuarios();
  } catch (error) {
    mostrarMensaje("Error al conectar.");
  }
}

async function cargarUsuarios() {
  try {
    const response = await fetch(`${API_URL}/usuarios`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const usuarios = await response.json();

    tablaUsuarios.innerHTML = "";

    usuarios.forEach((usuario) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
  <td class="p-3 font-semibold">
    ${usuario.nombre}
  </td>

  <td class="p-3 text-zinc-300">
    ${usuario.username}
  </td>

  <td class="p-3">
    ${usuario.rol}
  </td>

  <td class="p-3 text-zinc-400">
    ${usuario.tienda || usuario.tienda_id}
  </td>

  <td class="p-3">
    <span class="${
      usuario.activo
        ? "bg-green-500/20 text-green-300 border-green-500/30"
        : "bg-red-500/20 text-red-300 border-red-500/30"
    } border px-3 py-1 rounded-full text-xs font-bold">
      ${usuario.activo ? "ACTIVO" : "INACTIVO"}
    </span>
  </td>

  <td class="p-3">
    <div class="flex gap-2">

      <button
        onclick='editarUsuario(${JSON.stringify(usuario)})'
        class="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded-xl text-sm font-bold"
      >
        Editar
      </button>

      <button
        onclick="cambiarPassword(${usuario.id})"
        class="bg-indigo-500 hover:bg-indigo-400 text-black px-3 py-2 rounded-xl text-sm font-bold"
      >
        Password
      </button>

      <button
        onclick="toggleEstado(${usuario.id}, ${usuario.activo ? 0 : 1})"
        class="${
          usuario.activo
            ? "bg-red-500 hover:bg-red-400"
            : "bg-green-500 hover:bg-green-400"
        } text-black px-3 py-2 rounded-xl text-sm font-bold"
      >
        ${usuario.activo ? "Desactivar" : "Activar"}
      </button>

      <button
  onclick="verAccesos(${usuario.id}, '${usuario.nombre}')"
  class="bg-sky-500 hover:bg-sky-400 text-black px-3 py-2 rounded-xl text-sm font-bold"
>
  Ingresos
</button>

    </div>
  </td>
`;

      tablaUsuarios.appendChild(tr);
    });
  } catch (error) {
    mostrarMensaje("Error al cargar usuarios.");
  }
}

function limpiarFormulario() {
  nombre.value = "";
  username.value = "";
  password.value = "";
  rol.value = "empleado";
  tiendaId.value = "1";
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

function editarUsuario(usuario) {
  usuarioEditandoId = usuario.id;

  nombre.value = usuario.nombre;
  username.value = usuario.username;

  rol.value = usuario.rol;

  tiendaId.value = usuario.tienda_id;

  password.value = "";

  btnCrear.textContent = "Guardar cambios";
}

function cambiarPassword(id) {
  usuarioPasswordId = id;
  nuevaPasswordInput.value = "";
  mensajePassword.textContent = "";

  modalPassword.classList.remove("hidden");
  modalPassword.classList.add("flex");

  setTimeout(() => {
    nuevaPasswordInput.focus();
  }, 50);
}

function cerrarModalPassword() {
  usuarioPasswordId = null;
  nuevaPasswordInput.value = "";
  mensajePassword.textContent = "";

  modalPassword.classList.add("hidden");
  modalPassword.classList.remove("flex");
}

async function guardarNuevaPassword() {
  const nuevaPassword = nuevaPasswordInput.value.trim();

  if (!usuarioPasswordId) {
    mensajePassword.textContent = "Usuario no seleccionado.";
    return;
  }

  if (!nuevaPassword || nuevaPassword.length < 4) {
    mensajePassword.textContent = "La contraseña debe tener al menos 4 caracteres.";
    nuevaPasswordInput.focus();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/usuarios/${usuarioPasswordId}/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        password: nuevaPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      mensajePassword.textContent = data.error || "Error al cambiar contraseña.";
      return;
    }

    cerrarModalPassword();
    mostrarMensaje("Contraseña actualizada correctamente.");
  } catch (error) {
    mensajePassword.textContent = "Error al conectar.";
  }
}

async function toggleEstado(id, activo) {
  try {
    const response = await fetch(`${API_URL}/usuarios/${id}/estado`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        activo,
      }),
    });

    const data = await response.json();

    mostrarMensaje(data.mensaje || data.error);

    cargarUsuarios();
  } catch (error) {
    mostrarMensaje("Error al cambiar estado.");
  }
}

async function verAccesos(id, nombre) {
  try {
    tituloAccesos.textContent = `Ingresos de ${nombre}`;

    const response = await fetch(`${API_URL}/usuarios/${id}/accesos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al cargar accesos.");
      return;
    }

    tablaAccesos.innerHTML = "";

    data.forEach((acceso) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="p-3 font-semibold">
          ${formatearFechaLocal(acceso.fecha_ingreso)}
        </td>

        <td class="p-3 text-zinc-400">
          ${acceso.tienda || "-"}
        </td>
      `;

      tablaAccesos.appendChild(tr);
    });

    if (data.length === 0) {
      tablaAccesos.innerHTML = `
        <tr>
          <td colspan="2" class="p-6 text-center text-zinc-500">
            Sin ingresos registrados.
          </td>
        </tr>
      `;
    }
  } catch (error) {
    mostrarMensaje("Error al cargar accesos.");
  }
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
  });
}

function normalizarFechaSQLite(fechaTexto) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(fechaTexto)) {
    return fechaTexto;
  }

  return fechaTexto.replace(" ", "T") + "Z";
}
