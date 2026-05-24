const db = require("./connection");

db.run(
  `
  ALTER TABLE tipos_envase
  ADD COLUMN categoria TEXT DEFAULT 'refresco'
  `,
  (error) => {
    if (error && !error.message.includes("duplicate column")) {
      console.error("Error:", error.message);
      process.exit(1);
    }

    console.log("Columna categoria lista.");
    process.exit(0);
  }
);