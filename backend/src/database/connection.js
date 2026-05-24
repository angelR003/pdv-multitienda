const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
console.log("USANDO CONNECTION.JS NUEVO");

const dataDir = path.join(
  process.env.APPDATA,
  "LasGardenias",
  "data"
);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "pdv.sqlite");

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error("Error al conectar con SQLite:", error.message)
    console.log("DB PATH FINAL:", dbPath);;
  } else {
    console.log("Conectado a SQLite:", dbPath);
  }
});

module.exports = db;