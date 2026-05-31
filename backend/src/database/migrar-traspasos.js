const db = require("./connection");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS traspasos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tienda_origen_id INTEGER NOT NULL,
      tienda_destino_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      motivo TEXT,
      estado TEXT NOT NULL DEFAULT 'enviado'
        CHECK (estado IN ('pendiente', 'enviado', 'recibido', 'cancelado')),
      fecha_envio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_recepcion TEXT,
      FOREIGN KEY (tienda_origen_id) REFERENCES tiendas(id),
      FOREIGN KEY (tienda_destino_id) REFERENCES tiendas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS traspaso_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      traspaso_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      FOREIGN KEY (traspaso_id) REFERENCES traspasos(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `);

  console.log("Migración traspasos lista.");
});