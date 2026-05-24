const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const dataDir = path.join(
  process.env.APPDATA || process.cwd(),
  "LasGardenias",
  "data"
);

const dbPath = path.join(dataDir, "pdv.sqlite");

const schemaPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "database",
  "schema.sql"
);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

async function ensureDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const existeBD =
  fs.existsSync(dbPath) &&
  fs.statSync(dbPath).size > 0;

  const db = new sqlite3.Database(dbPath);

if (existeBD) {
  db.close();
  return;
}

  console.log("Creando base de datos inicial...");

  const schema = fs.readFileSync(schemaPath, "utf8");

  await new Promise((resolve, reject) => {
    db.exec(schema, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await run(db, `
    INSERT INTO tiendas (id, nombre, ubicacion, activa)
    VALUES
      (1, 'LAS GARDENIAS', '', 1),
      (2, 'LAS GARDENIAS 2', '', 1),
      (3, 'LOS ANGELES', '', 1)
  `);

  await run(db, `
    INSERT INTO usuarios (
      id,
      nombre,
      username,
      password_hash,
      rol,
      tienda_id,
      activo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    1,
    "Administrador General",
    "admin",
    passwordHash,
    "administrador",
    1,
    1,
  ]);

  const tiposEnvase = [
  ["cerveza", "Envase caguama", 10],
  ["cerveza", "Envase 1/2", 10],
  ["cerveza", "Envase 1/4", 10],
  ["refresco", "Coca-Cola 235 ml vidrio", 10],
  ["refresco", "Coca-Cola 500 ml vidrio", 10],
  ["refresco", "Coca-Cola 1.5 L plástico", 12],
  ["refresco", "Coca-Cola 2.5 L plástico", 12],
];

  for (const [categoria, nombre, importe] of tiposEnvase) {
    await run(db, `
      INSERT INTO tipos_envase (
        categoria,
        nombre,
        importe,
        activo
      )
      VALUES (?, ?, ?, 1)
    `, [categoria, nombre, importe]);
  }

  db.close();

  console.log("Base creada correctamente.");
  console.log("Usuario: admin");
  console.log("Contraseña: admin123");
}

module.exports = {
  ensureDatabase,
};