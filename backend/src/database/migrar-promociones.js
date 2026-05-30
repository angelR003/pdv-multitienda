const db = require("./connection");

const crearTablaPromociones = () => {
  const query = `
    CREATE TABLE IF NOT EXISTS promociones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad_requerida INTEGER NOT NULL,
      precio_promocion REAL NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TEXT,

      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `;

  db.run(query, (error) => {
    if (error) {
      console.error("Error al crear tabla promociones:", error.message);
      return;
    }

    console.log("Tabla promociones lista.");
  });
};

crearTablaPromociones();