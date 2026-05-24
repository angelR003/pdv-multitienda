const db = require("../database/connection");

const registrarDevolucion = (req, res) => {
  const {
    venta_id,
    tienda_id,
    usuario_id,
    motivo,
  } = req.body;

  if (
    !venta_id ||
    !tienda_id ||
    !usuario_id ||
    !motivo
  ) {
    return res.status(400).json({
      error: "Datos incompletos",
    });
  }

  const queryVenta = `
    SELECT *
    FROM ventas
    WHERE id = ?
  `;

  db.get(queryVenta, [venta_id], (errorVenta, venta) => {
    if (errorVenta) {
      return res.status(500).json({
        error: "Error al obtener venta",
      });
    }

    if (!venta) {
      return res.status(404).json({
        error: "Venta no encontrada",
      });
    }

    if (venta.estado === "devuelta_total") {
      return res.status(400).json({
        error: "La venta ya fue devuelta",
      });
    }

    const queryDetalles = `
      SELECT *
      FROM venta_detalles
      WHERE venta_id = ?
    `;

    db.all(queryDetalles, [venta_id], (errorDetalles, detalles) => {
      if (errorDetalles) {
        return res.status(500).json({
          error: "Error al obtener detalles",
        });
      }

      const actualizarInventario = detalles.map((detalle) => {
        return new Promise((resolve, reject) => {
          const queryUpdate = `
            UPDATE inventario
            SET cantidad_actual = cantidad_actual + ?
            WHERE tienda_id = ?
            AND producto_id = ?
          `;

          db.run(
            queryUpdate,
            [
              detalle.cantidad,
              tienda_id,
              detalle.producto_id,
            ],
            (errorUpdate) => {
              if (errorUpdate) {
                reject(errorUpdate);
              } else {
                resolve();
              }
            }
          );
        });
      });

      Promise.all(actualizarInventario)
        .then(() => {
          const queryEstado = `
            UPDATE ventas
            SET estado = 'devuelta_total'
            WHERE id = ?
          `;

          db.run(queryEstado, [venta_id], (errorEstado) => {
            if (errorEstado) {
              return res.status(500).json({
                error: "Error al actualizar venta",
              });
            }

            const queryDevolucion = `
              INSERT INTO devoluciones (
                venta_id,
                tienda_id,
                usuario_id,
                motivo,
                total_devuelto
              )
              VALUES (?, ?, ?, ?, ?)
            `;

            db.run(
              queryDevolucion,
              [
                venta_id,
                tienda_id,
                usuario_id,
                motivo,
                venta.total,
              ],
              function (errorDevolucion) {
                if (errorDevolucion) {
                  return res.status(500).json({
                    error: errorDevolucion.message,
                  });
                }

                res.status(201).json({
                  mensaje: "Devolución realizada correctamente",
                  devolucion_id: this.lastID,
                  total_devuelto: venta.total,
                });
              }
            );
          });
        })
        .catch(() => {
          res.status(500).json({
            error: "Error al actualizar inventario",
          });
        });
    });
  });
};

module.exports = {
  registrarDevolucion,
};