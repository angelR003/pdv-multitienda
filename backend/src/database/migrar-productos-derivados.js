const db = require("./connection");

const columnas = [
  {
    nombre: "es_derivado",
    sql: "ALTER TABLE productos ADD COLUMN es_derivado INTEGER NOT NULL DEFAULT 0",
  },
  {
    nombre: "producto_padre_id",
    sql: "ALTER TABLE productos ADD COLUMN producto_padre_id INTEGER",
  },
  {
    nombre: "factor_conversion",
    sql: "ALTER TABLE productos ADD COLUMN factor_conversion REAL NOT NULL DEFAULT 1",
  },
];

function agregarColumna(columna) {
  return new Promise((resolve) => {
    db.run(columna.sql, (error) => {
      if (error && !error.message.includes("duplicate column")) {
        console.error(`Error agregando ${columna.nombre}:`, error.message);
        resolve();
        return;
      }

      if (error) {
        console.log(`Columna ya existe: ${columna.nombre}`);
      } else {
        console.log(`Columna agregada: ${columna.nombre}`);
      }

      resolve();
    });
  });
}

async function migrar() {
  for (const columna of columnas) {
    await agregarColumna(columna);
  }

  console.log("Migracion productos derivados lista.");
}

migrar();
