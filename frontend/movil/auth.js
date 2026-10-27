(() => {
  "use strict";

  const database = globalThis.PdvLocalDB;
  const SESSION_KEY = "pdv-las-gardenias:session:v1";
  const ITERATIONS = 210000;
  const encoder = new TextEncoder();

  const toBase64 = bytes => {
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };

  const fromBase64 = value => {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  };

  const derive = async (password, salt, iterations = ITERATIONS) => {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return new Uint8Array(bits);
  };

  const sameBytes = (left, right) => {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
  };

  const setPassword = async (userId, password) => {
    if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    const user = await database.get("usuarios", userId);
    if (!user || user.activo === 0) throw new Error("El usuario no existe o está inactivo.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt);
    await database.setCredential({ user_id: userId, salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS });
    return true;
  };

  const createSession = user => {
    const session = {
      user_id: user.id,
      nombre: user.nombre,
      username: user.username,
      rol: user.rol,
      tienda_id: user.tienda_id,
      expires_at: Date.now() + 8 * 60 * 60 * 1000
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  };

  const login = async (username, password, terminalStoreId = null) => {
    const users = await database.list("usuarios");
    const normalized = String(username || "").trim().toLowerCase();
    const user = users.find(item => item.activo !== 0 && String(item.username || "").trim().toLowerCase() === normalized);
    if (!user) throw new Error("Usuario o contraseña incorrectos.");
    if (user.rol !== "administrador" && terminalStoreId && user.tienda_id && user.tienda_id !== terminalStoreId) {
      throw new Error("Este empleado no pertenece a la tienda configurada en el dispositivo.");
    }
    const credential = await database.getCredential(user.id);
    if (!credential) throw new Error("Este usuario todavía no tiene acceso configurado en el teléfono.");
    const candidate = await derive(String(password || ""), fromBase64(credential.salt), Number(credential.iterations || ITERATIONS));
    if (!sameBytes(candidate, fromBase64(credential.hash))) throw new Error("Usuario o contraseña incorrectos.");
    return createSession(user);
  };

  const getSession = () => {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!session?.user_id || Number(session.expires_at) <= Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  };

  const logout = () => localStorage.removeItem(SESSION_KEY);
  const hasCredentials = async () => (await database.listCredentials()).length > 0;

  globalThis.PdvLocalAuth = Object.freeze({ SESSION_KEY, setPassword, login, getSession, logout, hasCredentials, createSession });
})();
