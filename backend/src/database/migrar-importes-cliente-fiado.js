const db = require("./connection");

function asegurarColumnaClienteFiado() {
  db.all(`PRAGMA table_info(importes_envases)`, [], (err, columnas) => {
    if (err) {
      console.error("Error leyendo tabla:", err.message);
      return;
    }

    const existe = columnas.some(
      (col) => col.name === "cliente_fiado_id"
    );

    if (existe) {
      console.log("cliente_fiado_id ya existe.");
      return;
    }

    db.run(
      `
      ALTER TABLE importes_envases
      ADD COLUMN cliente_fiado_id INTEGER
      `,
      (error) => {
        if (error) {
          console.error(
            "Error agregando cliente_fiado_id:",
            error.message
          );
        } else {
          console.log(
            "Columna cliente_fiado_id agregada correctamente."
          );
        }
      }
    );
  });
}

asegurarColumnaClienteFiado();