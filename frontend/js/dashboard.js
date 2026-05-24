const token = localStorage.getItem("token");
const usuario = JSON.parse(localStorage.getItem("usuario"));
const tiendaNombre = localStorage.getItem("tienda_nombre") || "Terminal sin configurar";

if (!token || !usuario) {
  window.location.href = "./login.html";
}

const esAdmin = usuario.rol === "administrador";

const usuarioNombre = document.getElementById("usuarioNombre");
const usuarioRol = document.getElementById("usuarioRol");
const btnLogout = document.getElementById("btnLogout");

if (!esAdmin) {
  document.getElementById("cardUsuarios")?.remove();
}

usuarioNombre.textContent = usuario.nombre;
usuarioRol.textContent = `${usuario.rol} • ${tiendaNombre}`;

btnLogout.addEventListener("click", cerrarSesion);

function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");

  window.location.href = "./login.html";
}