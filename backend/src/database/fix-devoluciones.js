const db = require("./connection");

db.run(
  `
  ALTER TABLE devoluciones
  ADD COLUMN total_devuelto REAL DEFAULT 0
  `,
  (error) => {
    if (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }

    console.log("Columna total_devuelto agregada correctamente.");
    process.exit(0);
  }
);