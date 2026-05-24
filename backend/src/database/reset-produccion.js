const bcrypt = require("bcrypt");
const db = require("./connection");

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });

async function resetProduccion() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const tablas = [
    "venta_detalles",
    "ventas",
    "devoluciones",
    "devolucion_detalles",
    "cortes_caja",
    "movimientos_caja",
    "entrada_detalles",
    "entradas_mercancia",
    "ajustes_inventario",
    "inventario",
    "inventario_envases",
    "importes_envases",
    "envases_inventario",
    "movimientos_envase",
    "prestamos_envase",
    "productos",
    "precios_tienda",
    "usuarios",
    "tiendas",
    "tipos_envase",
    "abonos_fiado",
    "fiados",
    "clientes_fiado",
    "accesos_usuarios",
  ];

  try {
    await run("PRAGMA foreign_keys = OFF");

    for (const tabla of tablas) {
      try {
        await run(`DELETE FROM ${tabla}`);
        await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [tabla]);
        console.log(`Limpia: ${tabla}`);
      } catch (error) {
        console.log(`Saltando ${tabla}: ${error.message}`);
      }
    }

    await run(`
      INSERT INTO tiendas (id, nombre, ubicacion, activa)
      VALUES
        (1, 'LAS GARDENIAS', '', 1),
        (2, 'LAS GARDENIAS 2', '', 1),
        (3, 'LOS ANGELES', '', 1)
    `);

    await run(
      `
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
      `,
      [
        1,
        "Administrador General",
        "admin",
        passwordHash,
        "administrador",
        1,
        1,
      ]
    );

    const tiposEnvase = [
      ["cerveza", "Envase caguama", 10],
      ["cerveza", "Envase 1/2", 10],
      ["cerveza", "Envase 1/4", 10],
      ["refresco", "Coca-Cola 235 ml vidrio", 10],
      ["refresco", "Coca-Cola 500 ml vidrio", 12],
      ["refresco", "Coca-Cola 1.5 L plástico", 12],
      ["refresco", "Coca-Cola 2.5 L plástico", 12],
    ];

    for (const [categoria, nombre, importe] of tiposEnvase) {
      await run(
        `
        INSERT INTO tipos_envase (
          categoria,
          nombre,
          importe,
          activo
        )
        VALUES (?, ?, ?, 1)
        `,
        [categoria, nombre, importe]
      );
    }

    await run("PRAGMA foreign_keys = ON");

    console.log("Base limpiada para producción.");
    console.log("Usuario: admin");
    console.log("Contraseña: 123456");

    process.exit(0);
  } catch (error) {
    console.error("Error en reset:", error.message);
    process.exit(1);
  }
}

resetProduccion();