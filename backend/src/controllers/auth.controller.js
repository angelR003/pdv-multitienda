const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database/connection");

const JWT_SECRET = process.env.JWT_SECRET || "las_gardenias_secret_local";
const TOKEN_EXPIRA_EN = "8h";
const GRACIA_RENOVACION_MS = 12 * 60 * 60 * 1000;

const login = (req, res) => {
  const { username, password, tienda_id } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Usuario y contraseña son obligatorios",
    });
  }

  const query = `
    SELECT 
      u.id,
      u.nombre,
      u.username,
      u.password_hash,
      u.rol,
      u.tienda_id,
      t.nombre AS tienda
    FROM usuarios u
    LEFT JOIN tiendas t ON t.id = u.tienda_id
    WHERE u.username = ?
    AND u.activo = 1
    LIMIT 1
  `;

  db.get(query, [username], async (error, usuario) => {
    if (error) {
      return res.status(500).json({
        error: "Error al iniciar sesión",
      });
    }

    if (!usuario) {
      return res.status(401).json({
        error: "Usuario o contraseña incorrectos",
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({
        error: "Usuario o contraseña incorrectos",
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        tienda_id: usuario.tienda_id,
      },
      JWT_SECRET,
      {
        expiresIn: TOKEN_EXPIRA_EN,
      }
    );

    db.run(`
  INSERT INTO accesos_usuarios (
    usuario_id,
    tienda_id
  )
  VALUES (?, ?)
`, [
  usuario.id,
  tienda_id || null
]);

    res.json({
      mensaje: "Inicio de sesión correcto",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
        tienda_id: usuario.tienda_id,
        tienda: usuario.tienda,
      },
    });
  });
};

const renovarSesion = (req, res) => {
  const authHeader = req.headers.authorization;
  const tokenActual = authHeader ? authHeader.split(" ")[1] : null;

  if (!tokenActual) {
    return res.status(401).json({
      error: "Token requerido",
    });
  }

  let payload;

  try {
    payload = jwt.verify(tokenActual, JWT_SECRET, {
      ignoreExpiration: true,
    });
  } catch (error) {
    return res.status(401).json({
      error: "Sesion invalida",
    });
  }

  if (!payload?.id || !payload?.exp) {
    return res.status(401).json({
      error: "Sesion invalida",
    });
  }

  const expiroHaceMs = Date.now() - payload.exp * 1000;

  if (expiroHaceMs > GRACIA_RENOVACION_MS) {
    return res.status(401).json({
      error: "La sesion expiro hace demasiado tiempo. Inicia sesion nuevamente.",
    });
  }

  db.get(
    `
    SELECT
      id,
      nombre,
      rol,
      tienda_id
    FROM usuarios
    WHERE id = ?
    AND activo = 1
    LIMIT 1
    `,
    [payload.id],
    (error, usuario) => {
      if (error) {
        return res.status(500).json({
          error: "Error al renovar sesion",
        });
      }

      if (!usuario) {
        return res.status(401).json({
          error: "Usuario inactivo o inexistente",
        });
      }

      const token = jwt.sign(
        {
          id: usuario.id,
          nombre: usuario.nombre,
          rol: usuario.rol,
          tienda_id: usuario.tienda_id,
        },
        JWT_SECRET,
        {
          expiresIn: TOKEN_EXPIRA_EN,
        }
      );

      res.json({
        mensaje: "Sesion renovada correctamente",
        token,
      });
    }
  );
};

module.exports = {
  login,
  renovarSesion,
};
