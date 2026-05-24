const db = require("./connection");

const tipos = [
  ["cerveza", "Envase caguama", 0],
  ["cerveza", "Envase 1/2", 0],
  ["cerveza", "Envase 1/4", 0],
  ["refresco", "Coca-Cola 235 ml vidrio", 0],
  ["refresco", "Coca-Cola 500 ml vidrio", 0],
  ["refresco", "Coca-Cola 1.5 L plástico", 0],
  ["refresco", "Coca-Cola 2.5 L plástico", 12],
];

tipos.forEach(([categoria, nombre, importe]) => {
  db.run(
    `
    INSERT OR IGNORE INTO tipos_envase (
      categoria,
      nombre,
      importe
    )
    VALUES (?, ?, ?)
    `,
    [categoria, nombre, importe]
  );
});

console.log("Tipos de envase cargados.");