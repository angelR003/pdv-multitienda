const db = require("./connection");

db.run(
  `
  CREATE TABLE IF NOT EXISTS accesos_usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    tienda_id INTEGER,
    fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
  )
  `,
  (error) => {
    if (error) {
      console.error("Error al crear accesos_usuarios:", error.message);
      return;
    }

    console.log("Tabla accesos_usuarios lista.");
  }
);
