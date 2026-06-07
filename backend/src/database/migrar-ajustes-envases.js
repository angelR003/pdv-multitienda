const db = require("./connection");

db.run(
  `
  CREATE TABLE IF NOT EXISTS ajustes_envases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo_envase_id INTEGER NOT NULL,
    cantidad_anterior INTEGER NOT NULL,
    cantidad_nueva INTEGER NOT NULL,
    diferencia INTEGER NOT NULL,
    modo TEXT NOT NULL CHECK (modo IN ('sumar', 'restar', 'definir')),
    motivo TEXT NOT NULL,
    observaciones TEXT,
    fecha_ajuste TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id)
  )
  `,
  (error) => {
    if (error) {
      console.error("Error al crear ajustes_envases:", error.message);
      return;
    }

    console.log("Tabla ajustes_envases lista.");
  }
);
