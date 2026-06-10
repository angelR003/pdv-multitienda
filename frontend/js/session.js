(() => {
  const API_BASE = "http://localhost:3000/api";
  const AVISO_MINUTOS = 15;
  const tokenInicial = localStorage.getItem("token");

  let avisoMostrado = false;
  let sesionBloqueada = false;
  let timerAviso = null;
  let timerExpiracion = null;

  function decodificarToken(token) {
    try {
      const payload = token.split(".")[1];
      const normalizado = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(normalizado)
          .split("")
          .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join("")
      );

      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  function crearOverlay({ titulo, texto, acciones }) {
    let overlay = document.getElementById("sessionOverlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sessionOverlay";
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="
        width: min(460px, 100%);
        border: 1px solid #3f3f46;
        border-radius: 22px;
        background: linear-gradient(135deg, #18181b, #09090b);
        color: white;
        padding: 28px;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
        font-family: inherit;
      ">
        <div style="
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(250, 204, 21, 0.14);
          color: #facc15;
          font-size: 28px;
          font-weight: 900;
          margin-bottom: 18px;
        ">!</div>
        <h2 style="font-size: 28px; line-height: 1.1; margin: 0 0 10px; font-weight: 900;">
          ${titulo}
        </h2>
        <p style="margin: 0 0 22px; color: #d4d4d8; line-height: 1.5;">
          ${texto}
        </p>
        <div id="sessionActions" style="display: grid; gap: 10px;"></div>
      </div>
    `;

    const contenedor = overlay.querySelector("#sessionActions");
    acciones.forEach((accion) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = accion.texto;
      boton.style.cssText = accion.primario
        ? "width:100%;border:0;border-radius:14px;background:#22c55e;color:#000;font-weight:900;padding:14px 16px;cursor:pointer;"
        : "width:100%;border:1px solid #3f3f46;border-radius:14px;background:#27272a;color:#fff;font-weight:800;padding:14px 16px;cursor:pointer;";
      boton.addEventListener("click", accion.click);
      contenedor.appendChild(boton);
    });

    return overlay;
  }

  function quitarOverlay() {
    document.getElementById("sessionOverlay")?.remove();
  }

  function cerrarSesion(mensaje = "Tu sesion expiro. Vuelve a iniciar sesion.") {
    if (sesionBloqueada) return;

    sesionBloqueada = true;
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    crearOverlay({
      titulo: "Sesion expirada",
      texto: mensaje,
      acciones: [
        {
          texto: "Iniciar sesion",
          primario: true,
          click: () => {
            window.location.href = "./login.html";
          },
        },
      ],
    });
  }

  async function renovarSesion() {
    const token = localStorage.getItem("token");

    if (!token) {
      cerrarSesion();
      return;
    }

    try {
      const response = await window.__fetchOriginal(`${API_BASE}/auth/renovar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        cerrarSesion(data.error || "Tu sesion ya no se puede renovar.");
        return;
      }

      localStorage.setItem("token", data.token);
      avisoMostrado = false;
      quitarOverlay();
      programarAvisos();
    } catch (error) {
      cerrarSesion("No se pudo renovar la sesion. Inicia sesion nuevamente.");
    }
  }

  function mostrarAvisoExpiracion(minutosRestantes) {
    if (avisoMostrado || sesionBloqueada) return;

    avisoMostrado = true;
    crearOverlay({
      titulo: "La sesion esta por expirar",
      texto: `Quedan aproximadamente ${minutosRestantes} minutos. Puedes extenderla ahora para seguir trabajando sin perder el ritmo.`,
      acciones: [
        {
          texto: "Extender sesion",
          primario: true,
          click: renovarSesion,
        },
        {
          texto: "Seguir sin extender",
          primario: false,
          click: quitarOverlay,
        },
        {
          texto: "Cerrar sesion",
          primario: false,
          click: () => cerrarSesion("Sesion cerrada correctamente."),
        },
      ],
    });
  }

  function programarAvisos() {
    clearTimeout(timerAviso);
    clearTimeout(timerExpiracion);

    const token = localStorage.getItem("token");
    const payload = decodificarToken(token || "");

    if (!payload?.exp) return;

    const ahora = Date.now();
    const expiraEnMs = payload.exp * 1000 - ahora;
    const avisoEnMs = expiraEnMs - AVISO_MINUTOS * 60 * 1000;

    if (expiraEnMs <= 0) {
      cerrarSesion();
      return;
    }

    timerExpiracion = setTimeout(() => cerrarSesion(), expiraEnMs);

    if (avisoEnMs <= 0) {
      mostrarAvisoExpiracion(Math.max(1, Math.ceil(expiraEnMs / 60000)));
      return;
    }

    timerAviso = setTimeout(() => {
      mostrarAvisoExpiracion(AVISO_MINUTOS);
    }, avisoEnMs);
  }

  window.__fetchOriginal = window.__fetchOriginal || window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await window.__fetchOriginal(...args);
    const url = String(args[0]?.url || args[0] || "");

    if (
      response.status === 401 &&
      url.includes("/api/") &&
      !url.includes("/auth/login")
    ) {
      cerrarSesion("Tu sesion expiro o ya no es valida. Inicia sesion nuevamente para continuar.");
    }

    return response;
  };

  if (tokenInicial) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", programarAvisos);
    } else {
      programarAvisos();
    }
  }
})();
