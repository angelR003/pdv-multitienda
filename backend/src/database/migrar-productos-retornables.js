const db = require("./connection");

function agregarColumna(tabla, columna, definicion) {
  db.all(`PRAGMA table_info(${tabla})`, [], (error, columnas) => {
    if (error) {
      console.error(`Error leyendo columnas de ${tabla}:`, error.message);
      return;
    }

    const existe = columnas.some((col) => col.name === columna);

    if (existe) {
      console.log(`La columna ${columna} ya existe en ${tabla}.`);
      return;
    }

    db.run(
      `ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`,
      (errorAlter) => {
        if (errorAlter) {
          console.error(`Error agregando columna ${columna}:`, errorAlter.message);
          return;
        }

        console.log(`Columna ${columna} agregada a ${tabla}.`);
      }
    );
  });
}

agregarColumna("productos", "es_retornable", "INTEGER NOT NULL DEFAULT 0");
agregarColumna("productos", "tipo_envase_id", "INTEGER");