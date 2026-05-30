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
          return res.status(500).json({
            error: "Error al actualizar inventario",
          });
        });
    });
  });
};

const actualizarEstadoVentaPorDevolucion = (ventaId, callback) => {
  const query = `
    SELECT
      (
        SELECT COALESCE(SUM(cantidad), 0)
        FROM venta_detalles
        WHERE venta_id = ?
      ) AS total_vendido,

      (
        SELECT COALESCE(SUM(dd.cantidad), 0)
        FROM devolucion_detalles dd
        INNER JOIN devoluciones d
          ON d.id = dd.devolucion_id
        WHERE d.venta_id = ?
      ) AS total_devuelto
  `;

  db.get(query, [ventaId, ventaId], (error, row) => {
    if (error) {
      return callback(error);
    }

    const totalVendido = Number(row.total_vendido || 0);
    const totalDevuelto = Number(row.total_devuelto || 0);

    let nuevoEstado = "completada";

    if (totalDevuelto > 0 && totalDevuelto < totalVendido) {
      nuevoEstado = "devuelta_parcial";
    }

    if (totalVendido > 0 && totalDevuelto >= totalVendido) {
      nuevoEstado = "devuelta_total";
    }

    db.run(
      `
      UPDATE ventas
      SET estado = ?
      WHERE id = ?
      `,
      [nuevoEstado, ventaId],
      (errorUpdate) => {
        if (errorUpdate) {
          return callback(errorUpdate);
        }

        callback(null, nuevoEstado);
      }
    );
  });
};

const registrarDevolucionRenglon = (req, res) => {
  const {
    venta_id,
    venta_detalle_id,
    producto_id,
    tienda_id,
    usuario_id,
    cantidad,
    precio_unitario,
    motivo,
  } = req.body;

  if (
    !venta_id ||
    !venta_detalle_id ||
    !producto_id ||
    !tienda_id ||
    !usuario_id ||
    !cantidad ||
    !precio_unitario ||
    !motivo
  ) {
    return res.status(400).json({
      error: "Datos incompletos",
    });
  }

  const cantidadDevuelta = Number(cantidad);
  const totalDevuelto = cantidadDevuelta * Number(precio_unitario);

  db.get(
    `
    SELECT *
    FROM venta_detalles
    WHERE id = ?
    AND venta_id = ?
    AND producto_id = ?
    `,
    [venta_detalle_id, venta_id, producto_id],
    (errorDetalle, detalle) => {
      if (errorDetalle) {
        return res.status(500).json({
          error: "Error al obtener detalle de venta",
          detalle: errorDetalle.message,
        });
      }

      if (!detalle) {
        return res.status(404).json({
          error: "Detalle de venta no encontrado",
        });
      }

      db.get(
        `
        SELECT COALESCE(SUM(dd.cantidad), 0) AS cantidad_devuelta
        FROM devolucion_detalles dd
        INNER JOIN devoluciones d ON d.id = dd.devolucion_id
        WHERE d.venta_id = ?
        AND dd.producto_id = ?
        `,
        [venta_id, producto_id],
        (errorDevueltas, rowDevueltas) => {
          if (errorDevueltas) {
            return res.status(500).json({
              error: "Error al revisar devoluciones previas",
              detalle: errorDevueltas.message,
            });
          }

          const cantidadVendida = Number(detalle.cantidad);
          const cantidadYaDevuelta = Number(rowDevueltas.cantidad_devuelta || 0);
          const cantidadDisponible = cantidadVendida - cantidadYaDevuelta;

          if (cantidadDisponible <= 0) {
            return res.status(400).json({
              error: "Este producto ya fue devuelto completamente.",
            });
          }

          if (
            cantidadDevuelta <= 0 ||
            cantidadDevuelta > cantidadDisponible
          ) {
            return res.status(400).json({
              error: `Solo puedes devolver máximo ${cantidadDisponible}.`,
            });
          }

          db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            db.run(
              `
              INSERT INTO devoluciones (
                venta_id,
                tienda_id,
                usuario_id,
                motivo,
                total_devuelto
              )
              VALUES (?, ?, ?, ?, ?)
              `,
              [
                venta_id,
                tienda_id,
                usuario_id,
                motivo,
                totalDevuelto,
              ],
              function (errorDevolucion) {
                if (errorDevolucion) {
                  db.run("ROLLBACK");
                  return res.status(500).json({
                    error: "Error al registrar devolución",
                    detalle: errorDevolucion.message,
                  });
                }

                const devolucionId = this.lastID;

                db.run(
                  `
                  INSERT INTO devolucion_detalles (
                    devolucion_id,
                    producto_id,
                    cantidad,
                    estado_producto,
                    monto_devuelto
                  )
                  VALUES (?, ?, ?, ?, ?)
                  `,
                  [
                    devolucionId,
                    producto_id,
                    cantidadDevuelta,
                    "regresa_inventario",
                    totalDevuelto,
                  ],
                  (errorDetalleDev) => {
                    if (errorDetalleDev) {
                      db.run("ROLLBACK");
                      return res.status(500).json({
                        error: "Error al registrar detalle de devolución",
                        detalle: errorDetalleDev.message,
                      });
                    }

                    db.run(
                      `
                      UPDATE inventario
                      SET cantidad_actual = cantidad_actual + ?
                      WHERE tienda_id = ?
                      AND producto_id = ?
                      `,
                      [
                        cantidadDevuelta,
                        tienda_id,
                        producto_id,
                      ],
                      (errorInventario) => {
                        if (errorInventario) {
                          db.run("ROLLBACK");
                          return res.status(500).json({
                            error: "Error al regresar inventario",
                            detalle: errorInventario.message,
                          });
                        }

actualizarEstadoVentaPorDevolucion(
  venta_id,
  (errorEstadoVenta, nuevoEstadoVenta) => {
    if (errorEstadoVenta) {
      db.run("ROLLBACK");
      return res.status(500).json({
        error: "Error al actualizar estado de la venta",
        detalle: errorEstadoVenta.message,
      });
    }

    db.run("COMMIT", (errorCommit) => {
      if (errorCommit) {
        db.run("ROLLBACK");
        return res.status(500).json({
          error: "Error al confirmar devolución",
          detalle: errorCommit.message,
        });
      }

      return res.status(201).json({
        mensaje: "Producto devuelto correctamente",
        devolucion_id: devolucionId,
        total_devuelto: totalDevuelto,
        estado_venta: nuevoEstadoVenta,
      });
    });
  }
);
                      }
                    );
                  }
                );
              }
            );
          });
        }
      );
    }
  );
};

const obtenerHistorialDevolucionesVenta = (req, res) => {
  const { venta_id } = req.params;

  if (!venta_id) {
    return res.status(400).json({
      error: "Falta el ID de la venta",
    });
  }

  const query = `
    SELECT
      d.id AS devolucion_id,
      d.venta_id,
      d.motivo,
      d.total_devuelto,
      d.fecha_devolucion,

      dd.producto_id,
      dd.cantidad,
      dd.estado_producto,
      dd.monto_devuelto,

      p.nombre AS producto_nombre,

      u.nombre AS usuario_nombre

    FROM devoluciones d

    INNER JOIN devolucion_detalles dd
      ON dd.devolucion_id = d.id

    INNER JOIN productos p
      ON p.id = dd.producto_id

    LEFT JOIN usuarios u
      ON u.id = d.usuario_id

    WHERE d.venta_id = ?

    ORDER BY d.fecha_devolucion DESC, d.id DESC
  `;

  db.all(query, [venta_id], (error, devoluciones) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener historial de devoluciones",
        detalle: error.message,
      });
    }

    return res.json(devoluciones);
  });
};


module.exports = {
  registrarDevolucion,
  registrarDevolucionRenglon,
  obtenerHistorialDevolucionesVenta,
};