const db = require("../database/connection");

const registrarMovimientoCaja = (req, res) => {
  const {
    tienda_id,
    usuario_id,
    tipo_movimiento,
    monto,
    concepto,
    observaciones,
  } = req.body;

  const tiposPermitidos = [
    "fondo_inicial",
    "entrada_dinero",
    "salida_dinero",
    "pago_proveedor",
    "retiro",
    "ajuste",
  ];

  if (!tienda_id || !usuario_id || !tipo_movimiento || !monto || !concepto) {
    return res.status(400).json({
      error: "Tienda, usuario, tipo, monto y concepto son obligatorios",
    });
  }

  if (!tiposPermitidos.includes(tipo_movimiento)) {
    return res.status(400).json({
      error: "Tipo de movimiento inválido",
    });
  }

  if (monto <= 0) {
    return res.status(400).json({
      error: "El monto debe ser mayor a 0",
    });
  }

  const query = `
    INSERT INTO movimientos_caja (
      tienda_id,
      usuario_id,
      tipo_movimiento,
      monto,
      concepto,
      observaciones
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      tienda_id,
      usuario_id,
      tipo_movimiento,
      monto,
      concepto,
      observaciones || null,
    ],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al registrar movimiento de caja",
        });
      }

      res.status(201).json({
        mensaje: "Movimiento de caja registrado correctamente",
        movimiento_id: this.lastID,
      });
    }
  );
};

const obtenerMovimientosCaja = (req, res) => {
  const query = `
  SELECT
  m.id,
  m.tienda_id,
  t.nombre AS tienda,
  u.nombre AS usuario,
  m.tipo_movimiento,
  m.monto,
  m.concepto,
  m.observaciones,
  m.fecha_movimiento
    FROM movimientos_caja m
    INNER JOIN tiendas t ON t.id = m.tienda_id
    INNER JOIN usuarios u ON u.id = m.usuario_id
    ORDER BY m.fecha_movimiento DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener movimientos de caja",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  registrarMovimientoCaja,
  obtenerMovimientosCaja,
};