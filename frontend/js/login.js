const API_URL = "http://localhost:3000/api";

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const mensaje = document.getElementById("mensaje");

btnLogin.addEventListener("click", async () => {
  await iniciarSesion();
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