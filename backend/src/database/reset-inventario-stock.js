const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = process.argv[2];
const stockObjetivo = Number(process.argv[3] || 50);

if (!dbPath) {
  console.error(
    "Uso: node backend/src/database/reset-inventario-stock.js <ruta-pdv.sqlite> [stock]"
  );
  process.exit(1);
}

if (!Number.isFinite(stockObjetivo) || stockObjetivo < 0) {
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
  `pdv-pre-reset-inventario-${timestamp}.sqlite`
);

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

async function contarTablas() {
  const tablas = await all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const conteos = {};
  for (const { name } of tablas) {
    conteos[name] = (await get(`SELECT COUNT(*) AS total FROM "${name}"`)).total;
  }
  return conteos;
}

async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(resolvedDbPath, backupPath);

  const antes = await contarTablas();
  const stockAntes = await get(`
    SELECT
      COUNT(*) AS filas,
      MIN(cantidad_actual) AS minimo,
      MAX(cantidad_actual) AS maximo
    FROM inventario
  `);

  try {
    await run("PRAGMA foreign_keys = ON");
    await run("BEGIN TRANSACTION");

    await run(`
      INSERT OR IGNORE INTO inventario (
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
      WHERE COALESCE(productos.es_derivado, 0) = 0
    `, [stockObjetivo]);

    await run(`
      UPDATE inventario
      SET
        cantidad_actual = ?,
        ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE EXISTS (
        SELECT 1
        FROM productos
        WHERE productos.id = inventario.producto_id
          AND COALESCE(productos.es_derivado, 0) = 0
      )
    `, [stockObjetivo]);

    await run("COMMIT");

    const despues = await contarTablas();
    const stockDespues = await get(`
      SELECT
        COUNT(*) AS filas,
        MIN(cantidad_actual) AS minimo,
        MAX(cantidad_actual) AS maximo
      FROM inventario
    `);
    const stockDistinto = await get(
      `
        SELECT COUNT(*) AS total
        FROM inventario
        INNER JOIN productos ON productos.id = inventario.producto_id
        WHERE COALESCE(productos.es_derivado, 0) = 0
          AND inventario.cantidad_actual <> ?
      `,
      [stockObjetivo]
    );

    const cambiosConteo = Object.keys(despues)
      .filter((tabla) => antes[tabla] !== despues[tabla])
      .map((tabla) => ({
        tabla,
        antes: antes[tabla],
        despues: despues[tabla],
      }));

    console.log("Inventario reajustado.");
    console.log(`Base: ${resolvedDbPath}`);
    console.log(`Respaldo: ${backupPath}`);
    console.log(`Stock aplicado: ${stockObjetivo}`);
    console.log("Stock antes:", stockAntes);
    console.log("Stock despues:", stockDespues);
    console.log("Filas con stock distinto:", stockDistinto.total);
    console.log("Cambios de conteo por tabla:", cambiosConteo);
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    console.error("Error durante el reset de inventario. Se conservo el respaldo.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
