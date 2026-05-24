const bcrypt = require("bcryptjs");
const db = require("../database/connection");

const obtenerUsuarios = (req, res) => {
  const query = `
    SELECT
      u.id,
      u.nombre,
      u.username,
      u.rol,
      u.tienda_id,
      t.nombre AS tienda,
      u.activo,
      u.fecha_creacion
    FROM usuarios u
    LEFT JOIN tiendas t ON t.id = u.tienda_id
    ORDER BY u.fecha_creacion DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener usuarios",
      });
    }

    res.json(rows);
  });
};

const crearUsuario = async (req, res) => {
  const {
    nombre,
    username,
    password,
    rol,
    tienda_id,
  } = req.body;

  if (!nombre || !username || !password || !rol || !tienda_id) {
    return res.status(400).json({
      error: "Nombre, usuario, contraseña, rol y tienda son obligatorios",
    });
  }

  if (!["administrador", "empleado"].includes(rol)) {
    return res.status(400).json({
      error: "Rol inválido",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO usuarios (
        nombre,
        username,
        password_hash,
        rol,
        tienda_id
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(
      query,
      [nombre, username, passwordHash, rol, tienda_id],
      function (error) {
        if (error) {
          if (error.message.includes("UNIQUE")) {
            return res.status(400).json({
              error: "Ya existe un usuario con ese username",
            });
          }

          return res.status(500).json({
            error: "Error al crear usuario",
          });
        }

        res.status(201).json({
          mensaje: "Usuario creado correctamente",
          usuario_id: this.lastID,
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      error: "Error interno al crear usuario",
    });
  }
};

const actualizarUsuario = (req, res) => {
  const { id } = req.params;

  const {
    nombre,
    username,
    rol,
    tienda_id,
  } = req.body;

  if (!nombre || !username || !rol || !tienda_id) {
    return res.status(400).json({
      error: "Nombre, usuario, rol y tienda son obligatorios",
    });
  }

  if (!["administrador", "empleado"].includes(rol)) {
    return res.status(400).json({
      error: "Rol inválido",
    });
  }

  const query = `
    UPDATE usuarios
    SET
      nombre = ?,
      username = ?,
      rol = ?,
      tienda_id = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [nombre, username, rol, tienda_id, id],
    function (error) {
      if (error) {
        if (error.message.includes("UNIQUE")) {
          return res.status(400).json({
            error: "Ya existe un usuario con ese username",
          });
        }

        return res.status(500).json({
          error: "Error al actualizar usuario",
        });
      }

      res.json({
        mensaje: "Usuario actualizado correctamente",
      });
    }
  );
};

const cambiarPasswordUsuario = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({
      error: "La contraseña debe tener al menos 4 caracteres",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      UPDATE usuarios
      SET password_hash = ?
      WHERE id = ?
    `;

    db.run(query, [passwordHash, id], function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al cambiar contraseña",
        });
      }

      res.json({
        mensaje: "Contraseña actualizada correctamente",
      });
    });
  } catch (error) {
    res.status(500).json({
      error: "Error interno al cambiar contraseña",
    });
  }
};

const cambiarEstadoUsuario = (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (activo == null) {
    return res.status(400).json({
      error: "Estado requerido",
    });
  }

  const query = `
    UPDATE usuarios
    SET activo = ?
    WHERE id = ?
  `;

  db.run(query, [activo ? 1 : 0, id], function (error) {
    if (error) {
      return res.status(500).json({
        error: "Error al cambiar estado",
      });
    }

    res.json({
      mensaje: "Estado actualizado correctamente",
    });
  });
};


const obtenerAccesosUsuario = (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      a.id,
      a.fecha_ingreso,
      t.nombre AS tienda
    FROM accesos_usuarios a
    LEFT JOIN tiendas t ON t.id = a.tienda_id
    WHERE a.usuario_id = ?
    ORDER BY a.fecha_ingreso DESC
    LIMIT 50
  `;

  db.all(query, [id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener accesos",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPasswordUsuario,
  cambiarEstadoUsuario,
  obtenerAccesosUsuario,
};