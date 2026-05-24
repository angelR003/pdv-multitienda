const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database/connection");


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
      process.env.JWT_SECRET || "las_gardenias_secret_local",
      {
        expiresIn: "8h",
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

module.exports = {
  login,
};