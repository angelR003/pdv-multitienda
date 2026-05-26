const db = require("./connection");

db.all(
  "PRAGMA table_info(devoluciones)",
  [],
  (error, columnas) => {
    if (error) {
      console.error(
        "Error revisando tabla devoluciones:",
        error.message
      );
      return;
    }

    const existe = columnas.some(
      (col) => col.name === "total_devuelto"
    );

    if (existe) {
      console.log(
        "La columna total_devuelto ya existe."
      );
      return;
    }

    db.run(
      `
      ALTER TABLE devoluciones
      ADD COLUMN total_devuelto REAL DEFAULT 0
      `,
      (err) => {
        if (err) {
          console.error(
            "Error agregando total_devuelto:",
            err.message
          );
        } else {
          console.log(
            "Columna total_devuelto agregada correctamente."
          );
        }
      }
    );
  }
);