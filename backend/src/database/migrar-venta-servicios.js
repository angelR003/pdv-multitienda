const db = require("./connection");

db.run(
  `
  CREATE TABLE IF NOT EXISTS venta_servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'servicio')),
    descripcion TEXT NOT NULL,
    monto_base REAL NOT NULL,
    comision REAL NOT NULL DEFAULT 0,
    total_cobrado REAL NOT NULL,
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
  )
  `,
  (error) => {
    if (error) {
      console.error("Error al crear venta_servicios:", error.message);
      return;
    }

    console.log("Tabla venta_servicios lista.");
  }
);
