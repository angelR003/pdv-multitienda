const db = require("../database/connection");

const redondear = (valor) => Number(Number(valor || 0).toFixed(2));

const obtenerUltimoCorte = (tiendaId, callback) => {
  db.get(
    `
    SELECT fecha_corte
    FROM cortes_caja
    WHERE tienda_id = ?
    ORDER BY fecha_corte DESC
    LIMIT 1
    `,
    [tiendaId],
    (error, corte) => {
      if (error) {
        callback(error);
        return;
      }

      callback(null, corte ? corte.fecha_corte : "2000-01-01 00:00:00");
    }
  );
};

const calcularResumenCorte = (tiendaId, callback) => {
  obtenerUltimoCorte(tiendaId, (errorUltimo, fechaUltimoCorte) => {
    if (errorUltimo) {
      callback({
        status: 500,
        error: "Error al buscar ultimo corte",
        detalle: errorUltimo.message,
      });
      return;
    }

    db.get(
      `
      SELECT
        COALESCE(SUM(monto), 0) AS total_efectivo_bruto,
        COUNT(*) AS total_operaciones
      FROM (
        SELECT total AS monto
        FROM ventas
        WHERE tienda_id = ?
        AND metodo_pago = 'efectivo'
        AND fecha_venta > ?

        UNION ALL

        SELECT vp.monto
        FROM venta_pagos vp
        INNER JOIN ventas v
          ON v.id = vp.venta_id
        WHERE v.tienda_id = ?
        AND v.metodo_pago = 'mixto'
        AND vp.metodo_pago = 'efectivo'
        AND v.fecha_venta > ?
      )
      `,
      [tiendaId, fechaUltimoCorte, tiendaId, fechaUltimoCorte],
      (errorVentas, ventasData) => {
        if (errorVentas) {
          callback({
            status: 500,
            error: "Error al calcular ventas en efectivo",
            detalle: errorVentas.message,
          });
          return;
        }

        db.get(
          `
          SELECT
            COALESCE(SUM(d.total_devuelto), 0) AS total_devoluciones_efectivo,
            COUNT(*) AS total_devoluciones
          FROM devoluciones d
          INNER JOIN ventas v
            ON v.id = d.venta_id
          WHERE d.tienda_id = ?
          AND v.metodo_pago = 'efectivo'
          AND d.fecha_devolucion > ?
          `,
          [tiendaId, fechaUltimoCorte],
          (errorDevoluciones, devolucionesData) => {
            if (errorDevoluciones) {
              callback({
                status: 500,
                error: "Error al calcular devoluciones en efectivo",
                detalle: errorDevoluciones.message,
              });
              return;
            }

            db.get(
              `
              SELECT
                COALESCE(SUM(CASE
                  WHEN tipo_movimiento IN ('fondo_inicial', 'entrada_dinero', 'ajuste')
                  THEN monto ELSE 0 END), 0) AS total_entradas,

                COALESCE(SUM(CASE
                  WHEN tipo_movimiento IN ('salida_dinero', 'pago_proveedor', 'retiro')
                  THEN monto ELSE 0 END), 0) AS total_salidas
              FROM movimientos_caja
              WHERE tienda_id = ?
              AND fecha_movimiento > ?
              AND COALESCE(concepto, '') != 'Venta mixta efectivo'
              `,
              [tiendaId, fechaUltimoCorte],
              (errorMovimientos, movimientosData) => {
                if (errorMovimientos) {
                  callback({
                    status: 500,
                    error: "Error al calcular movimientos de caja",
                    detalle: errorMovimientos.message,
                  });
                  return;
                }

                db.all(
                  `
                  SELECT
                    m.id,
                    m.tipo_movimiento,
                    m.monto,
                    m.concepto,
                    m.observaciones,
                    m.fecha_movimiento,
                    u.nombre AS usuario
                  FROM movimientos_caja m
                  INNER JOIN usuarios u
                    ON u.id = m.usuario_id
                  WHERE m.tienda_id = ?
                  AND m.fecha_movimiento > ?
                  AND COALESCE(m.concepto, '') != 'Venta mixta efectivo'
                  ORDER BY m.fecha_movimiento DESC
                  `,
                  [tiendaId, fechaUltimoCorte],
                  (errorDetalleMovimientos, movimientos) => {
                    if (errorDetalleMovimientos) {
                      callback({
                        status: 500,
                        error: "Error al obtener detalle de movimientos",
                        detalle: errorDetalleMovimientos.message,
                      });
                      return;
                    }

                    db.all(
                      `
                      SELECT
                        d.id,
                        d.total_devuelto,
                        d.motivo,
                        d.fecha_devolucion,
                        u.nombre AS usuario
                      FROM devoluciones d
                      INNER JOIN ventas v
                        ON v.id = d.venta_id
                      INNER JOIN usuarios u
                        ON u.id = d.usuario_id
                      WHERE d.tienda_id = ?
                      AND v.metodo_pago = 'efectivo'
                      AND d.fecha_devolucion > ?
                      ORDER BY d.fecha_devolucion DESC
                      `,
                      [tiendaId, fechaUltimoCorte],
                      (errorDetalleDevoluciones, devoluciones) => {
                        if (errorDetalleDevoluciones) {
                          callback({
                            status: 500,
                            error: "Error al obtener detalle de devoluciones",
                            detalle: errorDetalleDevoluciones.message,
                          });
                          return;
                        }

                        const totalEfectivoBruto = redondear(
                          ventasData.total_efectivo_bruto
                        );
                        const totalDevolucionesEfectivo = redondear(
                          devolucionesData.total_devoluciones_efectivo
                        );
                        const totalEfectivo = redondear(
                          totalEfectivoBruto - totalDevolucionesEfectivo
                        );
                        const totalEntradas = redondear(movimientosData.total_entradas);
                        const totalSalidas = redondear(movimientosData.total_salidas);
                        const dineroEsperado = redondear(
                          totalEfectivo + totalEntradas - totalSalidas
                        );

                        callback(null, {
                          desde: fechaUltimoCorte,
                          ventas_efectivo_brutas: totalEfectivoBruto,
                          ventas_efectivo: totalEfectivo,
                          ventas_efectivo_operaciones: Number(
                            ventasData.total_operaciones || 0
                          ),
                          devoluciones_efectivo: totalDevolucionesEfectivo,
                          devoluciones_efectivo_operaciones: Number(
                            devolucionesData.total_devoluciones || 0
                          ),
                          entradas_caja: totalEntradas,
                          salidas_caja: totalSalidas,
                          dinero_esperado: dineroEsperado,
                          movimientos,
                          devoluciones,
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

const obtenerResumenCorteCaja = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  calcularResumenCorte(tienda_id, (errorResumen, resumen) => {
    if (errorResumen) {
      return res.status(errorResumen.status || 500).json(errorResumen);
    }

    return res.json(resumen);
  });
};

const crearCorteCaja = (req, res) => {
  const {
    tienda_id,
    usuario_id,
    dinero_real,
    observaciones,
  } = req.body;

  if (!tienda_id || !usuario_id || dinero_real == null) {
    return res.status(400).json({
      error: "Datos incompletos",
    });
  }

  calcularResumenCorte(tienda_id, (errorResumen, resumen) => {
    if (errorResumen) {
      return res.status(errorResumen.status || 500).json(errorResumen);
    }

    const diferencia = redondear(Number(dinero_real) - resumen.dinero_esperado);

    db.run(
      `
      INSERT INTO cortes_caja (
        tienda_id,
        usuario_id,
        total_efectivo,
        total_gastos,
        total_devoluciones,
        dinero_esperado,
        dinero_real,
        diferencia,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tienda_id,
        usuario_id,
        resumen.ventas_efectivo,
        resumen.salidas_caja,
        resumen.devoluciones_efectivo,
        resumen.dinero_esperado,
        dinero_real,
        diferencia,
        observaciones || null,
      ],
      function (errorInsert) {
        if (errorInsert) {
          return res.status(500).json({
            error: "Error al registrar corte",
            detalle: errorInsert.message,
          });
        }

        return res.status(201).json({
          mensaje: "Corte registrado correctamente",
          corte_id: this.lastID,
          ...resumen,
          dinero_real,
          diferencia,
        });
      }
    );
  });
};

const obtenerCortes = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT
      c.id,
      t.nombre AS tienda,
      u.nombre AS usuario,
      c.total_efectivo,
      c.total_gastos,
      c.dinero_esperado,
      c.dinero_real,
      c.diferencia,
      c.observaciones,
      c.fecha_corte
    FROM cortes_caja c
    INNER JOIN tiendas t ON t.id = c.tienda_id
    INNER JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.tienda_id = ?
    ORDER BY c.fecha_corte DESC
  `;

  db.all(query, [tienda_id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener cortes",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  crearCorteCaja,
  obtenerCortes,
  obtenerResumenCorteCaja,
};
