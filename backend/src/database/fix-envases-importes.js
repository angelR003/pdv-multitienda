const db = require("./connection");

const importes = [
  ["cerveza", "Envase caguama", 10],
  ["cerveza", "Envase 1/2", 10],
  ["cerveza", "Envase 1/4", 10],
  ["refresco", "Coca-Cola 235 ml vidrio", 10],
  ["refresco", "Coca-Cola 500 ml vidrio", 10],
  ["refresco", "Coca-Cola 1.5 L plástico", 12],
  ["refresco", "Coca-Cola 2.5 L plástico", 12],
];

db.serialize(() => {
  importes.forEach(([categoria, nombre, importe]) => {
    db.run(
      `
      UPDATE tipos_envase
      SET importe = ?
      WHERE categoria = ?
      AND nombre = ?
      `,
      [importe, categoria, nombre]
    );
  });

  console.log("Importes de envases corregidos.");
});

setTimeout(() => process.exit(0), 500);