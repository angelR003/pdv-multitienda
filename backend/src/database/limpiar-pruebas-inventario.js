const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.argv[2];
const stockInicial = Number(process.argv[3] || 50);

if (!dbPath) {
  console.error(
    "Uso: node backend/src/database/limpiar-pruebas-inventario.js <ruta-pdv.sqlite> [stock]"
  );
  process.exit(1);
}

if (!Number.isFinite(stockInicial) || stockInicial < 0) {
  console.error("El stock debe ser un numero mayor o igual a 0.");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`No existe la base de datos: ${dbPath}`);
  process.exit(1);
}

const resolvedDbPath = path.resolve(dbPath);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(__dirname, "../../../backups");
const backupPath = path.join(
  backupDir,
  `pdv-pre-limpieza-${timestamp}.sqlite`
);

const preservar = new Set(["tiendas", "usuarios", "productos", "tipos_envase"]);

const db = new sqlite3.Database(resolvedDbPath);

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });

async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(resolvedDbPath, backupPath);

  const tablas = await all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const tablasALimpiar = tablas
    .map((row) => row.name)
    .filter((name) => !preservar.has(name));

  const antes = {
    tiendas: await get("SELECT COUNT(*) AS total FROM tiendas"),
    usuarios: await get("SELECT COUNT(*) AS total FROM usuarios"),
    productos: await get("SELECT COUNT(*) AS total FROM productos"),
    inventario: await get("SELECT COUNT(*) AS total FROM inventario"),
  };

  try {
    await run("PRAGMA foreign_keys = OFF");
    await run("BEGIN TRANSACTION");

    for (const tabla of tablasALimpiar) {
      await run(`DELETE FROM "${tabla}"`);
      await run("DELETE FROM sqlite_sequence WHERE name = ?", [tabla]);
    }

    await run(`
      INSERT INTO inventario (
        tienda_id,
        producto_id,
        cantidad_actual,
        cantidad_minima,
        cantidad_maxima,
        ultima_actualizacion
      )
      SELECT
        tiendas.id,
        productos.id,
        ?,
        0,
        0,
        CURRENT_TIMESTAMP
      FROM tiendas
      CROSS JOIN productos
      WHERE COALESCE(tiendas.activa, 1) = 1
        AND COALESCE(productos.activo, 1) = 1
    `, [stockInicial]);

    await run("COMMIT");
    await run("PRAGMA foreign_keys = ON");

    const tablasOperativasConDatos = [];
    for (const tabla of tablasALimpiar.filter((name) => name !== "inventario")) {
      const row = await get(`SELECT COUNT(*) AS total FROM "${tabla}"`);
      if (row.total > 0) {
        tablasOperativasConDatos.push({ tabla, total: row.total });
      }
    }

    const despues = {
      tiendas: await get("SELECT COUNT(*) AS total FROM tiendas"),
      usuarios: await get("SELECT COUNT(*) AS total FROM usuarios"),
      productos: await get("SELECT COUNT(*) AS total FROM productos"),
      inventario: await get("SELECT COUNT(*) AS total FROM inventario"),
      stockDistinto: await get(
        "SELECT COUNT(*) AS total FROM inventario WHERE cantidad_actual <> ?",
        [stockInicial]
      ),
      tablasOperativasConDatos,
    };

    console.log("Limpieza terminada.");
    console.log(`Base: ${resolvedDbPath}`);
    console.log(`Respaldo: ${backupPath}`);
    console.log(`Stock aplicado: ${stockInicial}`);
    console.log("Antes:", antes);
    console.log("Despues:", despues);
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    console.error("Error durante la limpieza. Se conservo el respaldo.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
