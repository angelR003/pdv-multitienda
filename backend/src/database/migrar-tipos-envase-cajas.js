const db = require("./connection");

function ignorarColumnaDuplicada(error, nombre) {
  if (!error) {
    console.log(`${nombre} agregado en tipos_envase.`);
    return;
  }

  if (error.message.includes("duplicate column")) {
    console.log(`${nombre} ya existe en tipos_envase.`);
    return;
  }

  console.error(`Error agregando ${nombre}:`, error.message);
}

db.serialize(() => {
  db.run(
    "ALTER TABLE tipos_envase ADD COLUMN cantidad_por_caja INTEGER",
    (error) => ignorarColumnaDuplicada(error, "cantidad_por_caja")
  );

  db.run(
    "ALTER TABLE tipos_envase ADD COLUMN importe_por_caja REAL",
    (error) => ignorarColumnaDuplicada(error, "importe_por_caja")
  );

  db.run(
    `
    UPDATE tipos_envase
    SET
      cantidad_por_caja = COALESCE(cantidad_por_caja, 20),
      importe_por_caja = COALESCE(importe_por_caja, 100)
    WHERE LOWER(categoria) = 'cerveza'
    `,
    (error) => {
      if (error) {
        console.error("Error configurando cajas de cerveza:", error.message);
        return;
      }

      console.log("Cajas de cerveza configuradas.");
    }
  );

  db.run(
    `
    UPDATE importes_envases
    SET importe_total = (
      SELECT
        (
          CAST(importes_envases.cantidad / tipos_envase.cantidad_por_caja AS INTEGER)
          * tipos_envase.importe_por_caja
        )
        +
        (
          (CAST(importes_envases.cantidad AS INTEGER) % tipos_envase.cantidad_por_caja)
          * tipos_envase.importe
        )
      FROM tipos_envase
      WHERE tipos_envase.id = importes_envases.tipo_envase_id
    )
    WHERE escenario = 'dejo_importe'
    AND tipo_envase_id IN (
      SELECT id
      FROM tipos_envase
      WHERE LOWER(categoria) = 'cerveza'
      AND cantidad_por_caja > 0
      AND importe_por_caja > 0
    )
    `,
    (error) => {
      if (error) {
        console.error("Error recalculando importes de cerveza:", error.message);
        return;
      }

      console.log("Importes pendientes de cerveza recalculados.");
    }
  );
});
