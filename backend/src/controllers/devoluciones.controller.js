const db = require("../database/connection");

const asegurarColumnaServicioDevolucion = (callback) => {
  db.all("PRAGMA table_info(devolucion_detalles)", [], (error, columnas) => {
    if (error) {
      callback(error);
      return;
    }

    const existe = columnas.some((columna) => columna.name === "servicio_id");

    if (existe) {
      callback();
      return;
    }

    db.run(
      "ALTER TABLE devolucion_detalles ADD COLUMN servicio_id INTEGER",
      (errorAlter) => {
        if (errorAlter && !errorAlter.message.includes("duplicate column")) {
          callback(errorAlter);
          return;
        }

        callback();
      }
    );
  });
};

const obtenerProductoReferenciaDevolucion = (callback) => {
  db.get(
    `
    SELECT id
    FROM productos
    ORDER BY id ASC
    LIMIT 1
    `,
    [],
    (error, producto) => {
      if (error) {
        callback(error);
        return;
      }

      callback(null, producto?.id || null);
    }
  );
};

const cancelarEnvasesPendientesPorDevolucion = (
  { venta, tiendaId, usuarioId, detalles },
  callback
) => {
  const folio = venta?.folio;

  if (!folio || !Array.isArray(detalles) || detalles.length === 0) {
    callback();
    return;
  }

  const prefijoObservacion = `Venta ${folio} - `;
  const cantidadesPorProducto = new Map();

  detalles.forEach((detalle) => {
    const nombre = String(detalle.nombre_producto || "").trim();
    const cantidad = Number(detalle.cantidad);

    if (!nombre || cantidad <= 0) {
      return;
    }

    cantidadesPorProducto.set(
      nombre,
      (cantidadesPorProducto.get(nombre) || 0) + cantidad
    );
  });

  if (cantidadesPorProducto.size === 0) {
    callback();
    return;
  }

  db.all(
    `
    SELECT *
    FROM importes_envases
    WHERE tienda_id = ?
    AND estado = 'pendiente'
    AND cantidad_pendiente > 0
    AND observaciones LIKE ?
    ORDER BY id
    `,
    [tiendaId, `${prefijoObservacion}%`],
    (errorImportes, importes) => {
      if (errorImportes) {
        callback(errorImportes);
        return;
      }

      const procesarImporte = (index) => {
        if (index >= importes.length) {
          callback();
          return;
        }

        const importe = importes[index];
        const productoNombre = String(importe.observaciones || "").replace(
          prefijoObservacion,
          ""
        );
        const cantidadDisponible = cantidadesPorProducto.get(productoNombre) || 0;

        if (cantidadDisponible <= 0) {
          procesarImporte(index + 1);
          return;
        }

        const cantidadCancelar = Math.min(
          Number(importe.cantidad_pendiente),
          cantidadDisponible
        );
        const nuevaCantidadPendiente =
          Number(importe.cantidad_pendiente) - cantidadCancelar;
        const nuevoEstado =
          nuevaCantidadPendiente <= 0 ? "completado" : "pendiente";

        cantidadesPorProducto.set(
          productoNombre,
          cantidadDisponible - cantidadCancelar
        );

        db.run(
          `
          UPDATE importes_envases
          SET
            cantidad_pendiente = ?,
            estado = ?
          WHERE id = ?
          `,
          [nuevaCantidadPendiente, nuevoEstado, importe.id],
          (errorUpdate) => {
            if (errorUpdate) {
              callback(errorUpdate);
              return;
            }

            const montoCancelar =
              cantidadCancelar * Number(importe.importe_unitario || 0);

            if (importe.escenario === "envase_prestado") {
              procesarImporte(index + 1);
              return;
            }

            if (importe.escenario === "dejo_importe" && montoCancelar > 0) {
              db.run(
                `
                INSERT INTO movimientos_caja (
                  tienda_id,
                  usuario_id,
                  tipo_movimiento,
                  monto,
                  concepto,
                  observaciones
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                  tiendaId,
                  usuarioId,
                  "salida_dinero",
                  montoCancelar,
                  "Cancelacion importe por devolucion",
                  importe.cliente,
                ],
                (errorCaja) => {
                  if (errorCaja) {
                    callback(errorCaja);
                    return;
                  }

                  procesarImporte(index + 1);
                }
              );

              return;
            }

            procesarImporte(index + 1);
          }
        );
      };

      procesarImporte(0);
    }
  );
};

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

                const devolucionId = this.lastID;

                cancelarEnvasesPendientesPorDevolucion(
                  {
                    venta,
                    tiendaId: tienda_id,
                    usuarioId: usuario_id,
                    detalles,
                  },
                  (errorEnvases) => {
                    if (errorEnvases) {
                      return res.status(500).json({
                        error: "Error al cancelar envases pendientes",
                        detalle: errorEnvases.message,
                      });
                    }

                    res.status(201).json({
                      mensaje: "Devolución realizada correctamente",
                      devolucion_id: devolucionId,
                      total_devuelto: venta.total,
                    });
                  }
                );
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
      ) + (
        SELECT COALESCE(COUNT(*), 0)
        FROM venta_servicios
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

  db.get(query, [ventaId, ventaId, ventaId], (error, row) => {
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
    servicio_id,
    detalle_tipo,
    tienda_id,
    usuario_id,
    cantidad,
    precio_unitario,
    motivo,
  } = req.body;

  if (
    !venta_id ||
    !venta_detalle_id ||
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

  if (detalle_tipo === "servicio") {
    return registrarDevolucionServicio({
      venta_id,
      servicio_id: servicio_id || venta_detalle_id,
      tienda_id,
      usuario_id,
      cantidadDevuelta,
      totalDevuelto,
      motivo,
      res,
    });
  }

  if (!producto_id) {
    return res.status(400).json({
      error: "Producto requerido para devolver producto",
    });
  }

  db.get(
    `
    SELECT
      vd.*,
      v.folio AS folio_venta
    FROM venta_detalles vd
    INNER JOIN ventas v
      ON v.id = vd.venta_id
    WHERE vd.id = ?
    AND vd.venta_id = ?
    AND vd.producto_id = ?
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

    cancelarEnvasesPendientesPorDevolucion(
      {
        venta: { folio: detalle.folio_venta },
        tiendaId: tienda_id,
        usuarioId: usuario_id,
        detalles: [
          {
            ...detalle,
            cantidad: cantidadDevuelta,
          },
        ],
      },
      (errorEnvases) => {
        if (errorEnvases) {
          db.run("ROLLBACK");
          return res.status(500).json({
            error: "Error al cancelar envases pendientes",
            detalle: errorEnvases.message,
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
              }
            );
          });
        }
      );
    }
  );
};

const registrarDevolucionServicio = ({
  venta_id,
  servicio_id,
  tienda_id,
  usuario_id,
  cantidadDevuelta,
  totalDevuelto,
  motivo,
  res,
}) => {
  if (cantidadDevuelta !== 1) {
    return res.status(400).json({
      error: "Los servicios y recargas se devuelven completos.",
    });
  }

  db.get(
    `
    SELECT *
    FROM venta_servicios
    WHERE id = ?
    AND venta_id = ?
    `,
    [servicio_id, venta_id],
    (errorServicio, servicio) => {
      if (errorServicio) {
        return res.status(500).json({
          error: "Error al obtener servicio",
          detalle: errorServicio.message,
        });
      }

      if (!servicio) {
        return res.status(404).json({
          error: "Servicio de venta no encontrado",
        });
      }

      db.get(
        `
        SELECT COALESCE(SUM(dd.cantidad), 0) AS cantidad_devuelta
        FROM devolucion_detalles dd
        INNER JOIN devoluciones d ON d.id = dd.devolucion_id
        WHERE d.venta_id = ?
        AND dd.servicio_id = ?
        `,
        [venta_id, servicio_id],
        (errorDevueltas, rowDevueltas) => {
          if (errorDevueltas) {
            return res.status(500).json({
              error: "Error al revisar devoluciones previas",
              detalle: errorDevueltas.message,
            });
          }

          const cantidadYaDevuelta = Number(rowDevueltas.cantidad_devuelta || 0);

          if (cantidadYaDevuelta >= 1) {
            return res.status(400).json({
              error: "Este servicio ya fue devuelto completamente.",
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
                    error: "Error al registrar devolucion",
                    detalle: errorDevolucion.message,
                  });
                }

                const devolucionId = this.lastID;

                asegurarColumnaServicioDevolucion((errorColumna) => {
                  if (errorColumna) {
                    db.run("ROLLBACK");
                    return res.status(500).json({
                      error: "Error preparando devolucion de servicio",
                      detalle: errorColumna.message,
                    });
                  }

                  obtenerProductoReferenciaDevolucion((errorProductoRef, productoReferenciaId) => {
                    if (errorProductoRef) {
                      db.run("ROLLBACK");
                      return res.status(500).json({
                        error: "Error preparando producto de referencia",
                        detalle: errorProductoRef.message,
                      });
                    }

                    db.run(
                      `
                      INSERT INTO devolucion_detalles (
                        devolucion_id,
                        producto_id,
                        servicio_id,
                        cantidad,
                        estado_producto,
                        monto_devuelto
                      )
                      VALUES (?, ?, ?, ?, ?, ?)
                      `,
                      [
                        devolucionId,
                        productoReferenciaId,
                        servicio_id,
                        1,
                        "no_regresa_inventario",
                        totalDevuelto,
                      ],
                      (errorDetalleDev) => {
                        if (errorDetalleDev) {
                          db.run("ROLLBACK");
                          return res.status(500).json({
                            error: "Error al registrar detalle de devolucion",
                            detalle: errorDetalleDev.message,
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
                                  error: "Error al confirmar devolucion",
                                  detalle: errorCommit.message,
                                });
                              }

                              return res.status(201).json({
                                mensaje: "Servicio devuelto correctamente",
                                devolucion_id: devolucionId,
                                total_devuelto: totalDevuelto,
                                estado_venta: nuevoEstadoVenta,
                              });
                            });
                          }
                        );
                      }
                    );
                  });
                });
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
      dd.servicio_id,
      dd.cantidad,
      dd.estado_producto,
      dd.monto_devuelto,

      CASE
        WHEN dd.servicio_id IS NOT NULL THEN vs.descripcion
        ELSE p.nombre
      END AS producto_nombre,
      CASE
        WHEN dd.servicio_id IS NOT NULL THEN 'servicio'
        ELSE p.unidad
      END AS unidad,

      u.nombre AS usuario_nombre

    FROM devoluciones d

    INNER JOIN devolucion_detalles dd
      ON dd.devolucion_id = d.id

    LEFT JOIN productos p
      ON p.id = dd.producto_id

    LEFT JOIN venta_servicios vs
      ON vs.id = dd.servicio_id

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
