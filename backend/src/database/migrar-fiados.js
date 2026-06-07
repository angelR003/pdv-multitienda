const fs = require("fs");
const path = require("path");
const db = require("./connection");

const schemaPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "database",
  "schema.sql"
);

const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema, (error) => {
  if (error) {
    console.error("Error migrando fiados:", error.message);
    return;
  }

  console.log("Modulo de fiados listo.");
});
