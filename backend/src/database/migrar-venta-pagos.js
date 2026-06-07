const db = require("./connection");

db.run(
  `
  CREATE TABLE IF NOT EXISTS venta_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'fiado')),
    monto REAL NOT NULL,
    cliente_fiado_id INTEGER,
    observaciones TEXT,
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (cliente_fiado_id) REFERENCES clientes_fiado(id)
  )
  `,
  (error) => {
    if (error) {
      console.error("Error al crear venta_pagos:", error.message);
      return;
    }

    console.log("Tabla venta_pagos lista.");
  }
);
