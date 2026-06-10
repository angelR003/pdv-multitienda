const db = require("./connection");

db.run(
  "ALTER TABLE devolucion_detalles ADD COLUMN servicio_id INTEGER",
  (error) => {
    if (error && !error.message.includes("duplicate column")) {
      console.error("Error agregando servicio_id a devolucion_detalles:", error.message);
      return;
    }

    if (error) {
      console.log("servicio_id ya existe en devolucion_detalles.");
    } else {
      console.log("Columna servicio_id agregada a devolucion_detalles.");
    }
  }
);
