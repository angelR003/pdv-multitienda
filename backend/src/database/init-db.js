const fs = require("fs");
const path = require("path");
const db = require("./connection");

const schemaPath = path.join(__dirname, "../../../database/schema.sql");

const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema, (error) => {
  if (error) {
    console.error("Error al crear la base de datos:", error.message);
    process.exit(1);
  }

  console.log("Base de datos creada correctamente.");
  process.exit(0);
});