const fs = require("fs");
const path = require("path");
const db = require("./connection");

const seedPath = path.join(__dirname, "../../../database/seed.sql");

const seed = fs.readFileSync(seedPath, "utf8");

db.exec(seed, (error) => {
  if (error) {
    console.error("Error al insertar datos:", error.message);
    process.exit(1);
  }

  console.log("Datos de prueba insertados correctamente.");
  process.exit(0);
});