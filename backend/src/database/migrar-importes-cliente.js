const db = require("./connection");

db.run(`
  ALTER TABLE importes_envases
  ADD COLUMN cliente_fiado_id INTEGER
`, (error) => {
  if (error && !error.message.includes("duplicate column")) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Columna cliente_fiado_id lista.");
  process.exit(0);
});