const db = require("../database/connection");

const FILTRO_DEUDAS_ENVASE = `
  AND f.concepto NOT LIKE 'Envase prestado - %'
`;

const FILTRO_ABONOS_ENVASE = `
  AND COALESCE(a.observaciones, '') NOT LIKE 'Recepción de envase prestado:%'
  AND COALESCE(a.observaciones, '') NOT LIKE 'Recepcion de envase prestado:%'
  AND COALESCE(a.observaciones, '') NOT LIKE 'Cancelacion de envase por devolucion%'
`;

const crearClienteFiado = (req, res) => {
  const {
    nombre_completo,
    apodo,
    telefono,
    limite_credito,
  } = req.body;

  if (!nombre_completo?.trim()) {
    return res.status(400).json({
      error: "Nombre obligatorio",
    });
  }

  db.run(`
    INSERT INTO clientes_fiado (
      nombre_completo,
      apodo,
      telefono,
      limite_credito
    )
    VALUES (?, ?, ?, ?)
  `, [
    nombre_completo.trim(),
    apodo?.trim() || null,
    telefono?.trim() || null,
    Number(limite_credito) || 0,
  ], function(error) {

    if (error) {
      return res.status(500).json({
        error: "Error al crear cliente",
      });
    }

    res.json({
      mensaje: "Cliente creado",
      id: this.lastID,
    });
  });
};

const obtenerClientesFiado = (req, res) => {

  const query = `
    SELECT
      c.*,

      COALESCE((
        SELECT SUM(f.monto)
        FROM fiados f
        WHERE f.cliente_id = c.id
        ${FILTRO_DEUDAS_ENVASE}
      ), 0)

      -

      COALESCE((
        SELECT SUM(a.monto)
        FROM abonos_fiado a
        WHERE a.cliente_id = c.id
        ${FILTRO_ABONOS_ENVASE}
      ), 0)

      AS deuda_total,

      COALESCE((
        SELECT SUM(i.cantidad_pendiente)
        FROM importes_envases i
        WHERE i.cliente_fiado_id = c.id
        AND i.escenario = 'envase_prestado'
        AND i.estado = 'pendiente'
      ), 0) AS envases_pendientes,

      COALESCE((
        SELECT COUNT(*)
        FROM fiados f
        WHERE f.cliente_id = c.id
        AND f.concepto LIKE 'Envase prestado - %'
      ), 0) AS envases_historial

    FROM clientes_fiado c

    WHERE c.activo = 1

    ORDER BY deuda_total DESC
  `;

  db.all(query, [], (error, rows) => {

    if (error) {
      return res.status(500).json({
        error: "Error al obtener clientes",
      });
    }

    res.json(rows);
  });
};

const registrarFiado = (req, res) => {

  const {
    cliente_id,
    usuario_id,
    tienda_id,
    concepto,
    monto,
  } = req.body;

  if (!cliente_id || !monto || monto <= 0) {
    return res.status(400).json({
      error: "Datos inválidos",
    });
  }

  if (String(concepto || "").startsWith("Envase prestado - ")) {
    return res.status(400).json({
      error: "Los envases prestados se registran en Importes, no en Fiados",
    });
  }

  db.run(`
    INSERT INTO fiados (
      cliente_id,
      usuario_id,
      tienda_id,
      concepto,
      monto
    )
    VALUES (?, ?, ?, ?, ?)
  `, [
    cliente_id,
    usuario_id,
    tienda_id,
    concepto,
    monto,
  ], function(error) {

    if (error) {
      return res.status(500).json({
        error: "Error al registrar fiado",
      });
    }

    res.json({
      mensaje: "Fiado registrado",
      id: this.lastID,
    });
  });
};

const registrarAbono = (req, res) => {

  const {
    cliente_id,
    usuario_id,
    tienda_id,
    monto,
    observaciones,
  } = req.body;

  if (!cliente_id || !monto || monto <= 0) {
    return res.status(400).json({
      error: "Datos inválidos",
    });
  }

  db.serialize(() => {

    db.run(`
      INSERT INTO abonos_fiado (
        cliente_id,
        usuario_id,
        tienda_id,
        monto,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?)
    `, [
      cliente_id,
      usuario_id,
      tienda_id,
      monto,
      observaciones || null,
    ]);

    db.run(`
      INSERT INTO movimientos_caja (
        tienda_id,
        usuario_id,
        tipo_movimiento,
        monto,
        concepto,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      tienda_id,
      usuario_id,
      "entrada_dinero",
      monto,
      "Abono de fiado",
      observaciones || null,
    ], (error) => {

      if (error) {
        return res.status(500).json({
          error: "Error al registrar abono",
        });
      }

      res.json({
        mensaje: "Abono registrado",
      });
    });
  });
};

const obtenerHistorialCliente = (req, res) => {

  const { id } = req.params;

  const query = `
    SELECT
      CASE
        WHEN f.concepto LIKE 'Envase prestado - %'
        THEN 'envase_prestado'
        ELSE 'fiado'
      END AS tipo,
      f.id,
      f.concepto,
      CASE
        WHEN f.concepto LIKE 'Envase prestado - %'
        THEN 0
        ELSE f.monto
      END AS monto,
      f.fecha_fiado AS fecha,
      u.nombre AS usuario,
      t.nombre AS tienda

    FROM fiados f

    LEFT JOIN usuarios u ON u.id = f.usuario_id
    LEFT JOIN tiendas t ON t.id = f.tienda_id

    WHERE f.cliente_id = ?

    UNION ALL

    SELECT
      CASE
        WHEN COALESCE(a.observaciones, '') LIKE 'Recepción de envase prestado:%'
          OR COALESCE(a.observaciones, '') LIKE 'Recepcion de envase prestado:%'
          OR COALESCE(a.observaciones, '') LIKE 'Cancelacion de envase por devolucion%'
        THEN 'envase_devuelto'
        ELSE 'abono'
      END AS tipo,
      a.id,
      a.observaciones AS concepto,
      CASE
        WHEN COALESCE(a.observaciones, '') LIKE 'Recepción de envase prestado:%'
          OR COALESCE(a.observaciones, '') LIKE 'Recepcion de envase prestado:%'
          OR COALESCE(a.observaciones, '') LIKE 'Cancelacion de envase por devolucion%'
        THEN 0
        ELSE a.monto
      END AS monto,
      a.fecha_abono AS fecha,
      u.nombre AS usuario,
      t.nombre AS tienda

    FROM abonos_fiado a

    LEFT JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN tiendas t ON t.id = a.tienda_id

    WHERE a.cliente_id = ?

    ORDER BY fecha DESC
  `;

  db.all(query, [id, id], (error, rows) => {

    if (error) {
      return res.status(500).json({
        error: "Error al obtener historial",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  crearClienteFiado,
  obtenerClientesFiado,
  registrarFiado,
  registrarAbono,
  obtenerHistorialCliente,
};
