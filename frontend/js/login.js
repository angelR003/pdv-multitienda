const API_URL = "http://localhost:3000/api";

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnTogglePassword = document.getElementById("btnTogglePassword");
const iconPasswordEye = document.getElementById("iconPasswordEye");
const mensaje = document.getElementById("mensaje");

btnLogin.addEventListener("click", async () => {
  await iniciarSesion();
});

btnTogglePassword?.addEventListener("click", () => {
  const mostrarPassword = passwordInput.type === "password";

  passwordInput.type = mostrarPassword ? "text" : "password";
  btnTogglePassword.title = mostrarPassword
    ? "Ocultar contrasena"
    : "Mostrar contrasena";
  btnTogglePassword.setAttribute(
    "aria-label",
    mostrarPassword ? "Ocultar contrasena" : "Mostrar contrasena",
  );

  iconPasswordEye.innerHTML = mostrarPassword
    ? `
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5.5 20 2 12 2 12a20.3 20.3 0 0 1 5.06-5.94"></path>
      <path d="M9.9 4.24A10.45 10.45 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"></path>
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"></path>
      <path d="M1 1l22 22"></path>
    `
    : `
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `;
});

async function iniciarSesion() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    mostrarMensaje("Completa usuario y contraseña.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  username,
  password,
  tienda_id: Number(localStorage.getItem("tienda_id")) || null
}),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensaje(data.error || "Error al iniciar sesión.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));

    mostrarMensaje("Inicio de sesión correcto.");

    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 800);

  } catch (error) {
    mostrarMensaje("Error al conectar con servidor.");
  }
}

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}
