const db = require("../database/connection");

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

  const queryUltimoCorte = `
    SELECT fecha_corte
    FROM cortes_caja
    WHERE tienda_id = ?
    ORDER BY fecha_corte DESC
    LIMIT 1
  `;

  db.get(queryUltimoCorte, [tienda_id], (errorUltimo, ultimoCorte) => {
    if (errorUltimo) {
      return res.status(500).json({
        error: "Error al buscar último corte",
      });
    }

    const fechaUltimoCorte = ultimoCorte
      ? ultimoCorte.fecha_corte
      : "2000-01-01 00:00:00";

    const queryVentasEfectivo = `
      SELECT COALESCE(SUM(total), 0) AS total_efectivo
      FROM ventas
      WHERE tienda_id = ?
      AND estado = 'completada'
      AND metodo_pago = 'efectivo'
      AND fecha_venta > ?
    `;

    const queryMovimientos = `
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
    `;

    db.get(
      queryVentasEfectivo,
      [tienda_id, fechaUltimoCorte],
      (errorVentas, ventasData) => {
        if (errorVentas) {
          return res.status(500).json({
            error: "Error al calcular ventas en efectivo",
          });
        }

        db.get(
          queryMovimientos,
          [tienda_id, fechaUltimoCorte],
          (errorMovimientos, movimientosData) => {
            if (errorMovimientos) {
              return res.status(500).json({
                error: "Error al calcular movimientos de caja",
              });
            }

            const totalEfectivo = Number(
              (ventasData.total_efectivo || 0).toFixed(2)
            );

            const totalEntradas = Number(
              (movimientosData.total_entradas || 0).toFixed(2)
            );

            const totalSalidas = Number(
              (movimientosData.total_salidas || 0).toFixed(2)
            );

            const dineroEsperado = Number(
              (totalEfectivo + totalEntradas - totalSalidas).toFixed(2)
            );

            const diferencia = Number(
              (dinero_real - dineroEsperado).toFixed(2)
            );

            const queryInsert = `
              INSERT INTO cortes_caja (
                tienda_id,
                usuario_id,
                total_efectivo,
                total_gastos,
                dinero_esperado,
                dinero_real,
                diferencia,
                observaciones
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(
              queryInsert,
              [
                tienda_id,
                usuario_id,
                totalEfectivo,
                totalSalidas,
                dineroEsperado,
                dinero_real,
                diferencia,
                observaciones || null,
              ],
              function (errorInsert) {
                if (errorInsert) {
                  return res.status(500).json({
                    error: "Error al registrar corte",
                  });
                }

                res.status(201).json({
                  mensaje: "Corte registrado correctamente",
                  corte_id: this.lastID,
                  desde: fechaUltimoCorte,
                  ventas_efectivo: totalEfectivo,
                  entradas_caja: totalEntradas,
                  salidas_caja: totalSalidas,
                  dinero_esperado: dineroEsperado,
                  dinero_real,
                  diferencia,
                });
              }
            );
          }
        );
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
};