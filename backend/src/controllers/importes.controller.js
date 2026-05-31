const db = require("../database/connection");

const obtenerTiposEnvase = (req, res) => {
  db.all(
    `
    SELECT *
    FROM tipos_envase
    WHERE activo = 1
    ORDER BY categoria, nombre
    `,
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener tipos de envase",
          detalle: error.message
        });
      }

      res.json(rows);
    }
  );
};

const registrarImporte = (req, res) => {
  const {
    tienda_id,
    cliente,
    cliente_fiado_id,
    tipo_envase_id,
    escenario,
    cantidad,
    observaciones,
  } = req.body;

  const clienteNombre = String(cliente || "").trim();
  const cantidadNumero = Number(cantidad);
  const clienteFiadoIdNumero = cliente_fiado_id
    ? Number(cliente_fiado_id)
    : null;

  const escenariosValidos = [
    "dejo_importe",
    "trajo_envase",
    "envase_prestado",
  ];

 if (
  !tienda_id ||
  !clienteNombre ||
  !tipo_envase_id ||
  !escenario ||
  !cantidadNumero ||
  cantidadNumero <= 0
) {
  return res.status(400).json({
    error: "Todos los campos son obligatorios",
  });
}

if (!Number.isInteger(cantidadNumero)) {
  return res.status(400).json({
    error: "La cantidad de envases debe ser entera",
  });
}

  if (!escenariosValidos.includes(escenario)) {
    return res.status(400).json({
      error: "Escenario de envase inválido",
    });
  }

  if (
    cliente_fiado_id &&
    (!Number.isInteger(clienteFiadoIdNumero) || clienteFiadoIdNumero <= 0)
  ) {
    return res.status(400).json({
      error: "Cliente fiado inválido",
    });
  }

  db.get(
    `
    SELECT *
    FROM tipos_envase
    WHERE id = ?
    `,
    [tipo_envase_id],
    (error, tipoEnvase) => {
      if (error || !tipoEnvase) {
        return res.status(404).json({
          error: "Tipo de envase no encontrado",
        });
      }

      const importeUnitario = Number(tipoEnvase.importe);
      const importeTotal =
        escenario === "dejo_importe"
          ? importeUnitario * cantidadNumero
          : 0;

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const rollbackImporte = (mensaje, detalle) => {
          db.run("ROLLBACK", () => {
            return res.status(500).json({
              error: mensaje,
              detalle,
            });
          });
        };

        const confirmarImporte = () => {
          db.run("COMMIT", (errorCommit) => {
            if (errorCommit) {
              return rollbackImporte(
                "Error al confirmar importe",
                errorCommit.message
              );
            }

            return res.json({
              mensaje: "Importe registrado correctamente",
            });
          });
        };

        const resolverClienteFiado = (callback) => {
          if (escenario !== "envase_prestado" || clienteFiadoIdNumero) {
            callback(null, clienteFiadoIdNumero);
            return;
          }

          db.run(
            `
            INSERT INTO clientes_fiado (
              nombre_completo,
              apodo,
              telefono,
              limite_credito
            )
            VALUES (?, ?, ?, ?)
            `,
            [clienteNombre, null, null, 0],
            function (errorCliente) {
              if (errorCliente) {
                callback(errorCliente);
                return;
              }

              callback(null, this.lastID);
            }
          );
        };

        const registrarMovimientoRelacionado = (clienteFiadoIdResuelto) => {
          if (escenario === "dejo_importe") {
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
                tienda_id,
                req.usuario.id,
                "entrada_dinero",
                importeTotal,
                "Importe envases",
                clienteNombre,
              ],
              (errorCaja) => {
                if (errorCaja) {
                  return rollbackImporte(
                    "Error al registrar movimiento de caja",
                    errorCaja.message
                  );
                }

                confirmarImporte();
              }
            );

            return;
          }

          if (escenario === "trajo_envase") {
            db.run(
              `
              INSERT INTO inventario_envases (
                tienda_id,
                tipo_envase_id,
                cantidad_vacios
              )
              VALUES (?, ?, ?)
              ON CONFLICT(tienda_id, tipo_envase_id)
              DO UPDATE SET
                cantidad_vacios = cantidad_vacios + excluded.cantidad_vacios
              `,
              [tienda_id, tipo_envase_id, cantidadNumero],
              (errorInventario) => {
                if (errorInventario) {
                  return rollbackImporte(
                    "Error al actualizar contador de envases",
                    errorInventario.message
                  );
                }

                confirmarImporte();
              }
            );

            return;
          }

          if (escenario === "envase_prestado") {
            db.run(
              `
              INSERT INTO fiados (
                cliente_id,
                usuario_id,
                tienda_id,
                concepto,
                monto
              )
              VALUES (?, ?, ?, ?, ?)
              `,
              [
                clienteFiadoIdResuelto,
                req.usuario.id,
                tienda_id,
                `Envase prestado - ${tipoEnvase.nombre}`,
                importeUnitario * cantidadNumero,
              ],
              (errorFiado) => {
                if (errorFiado) {
                  return rollbackImporte(
                    "Error al registrar deuda de envase",
                    errorFiado.message
                  );
                }

                confirmarImporte();
              }
            );

            return;
          }

          confirmarImporte();
        };

        const guardarImporte = (clienteFiadoIdResuelto) => {
          db.run(
            `
            INSERT INTO importes_envases (
              tienda_id,
              usuario_id,
              cliente,
              cliente_fiado_id,
              tipo_envase_id,
              escenario,
              cantidad,
              cantidad_pendiente,
              importe_unitario,
              importe_total,
              estado,
              observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              tienda_id,
              req.usuario.id,
              clienteNombre,
              clienteFiadoIdResuelto || null,
              tipo_envase_id,
              escenario,
              cantidadNumero,
              escenario === "trajo_envase" ? 0 : cantidadNumero,
              importeUnitario,
              importeTotal,
              escenario === "trajo_envase" ? "completado" : "pendiente",
              observaciones || null,
            ],
            (errorImporte) => {
              if (errorImporte) {
                return rollbackImporte(
                  "Error al registrar importe",
                  errorImporte.message
                );
              }

              registrarMovimientoRelacionado(clienteFiadoIdResuelto);
            }
          );
        };

        resolverClienteFiado((errorCliente, clienteFiadoIdResuelto) => {
          if (errorCliente) {
            return rollbackImporte(
              "Error al resolver cliente fiado",
              errorCliente.message
            );
          }

          guardarImporte(clienteFiadoIdResuelto);
        });
      });
    }
  );
};
const obtenerImportes = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT
      i.id,
      i.cliente,
      i.escenario,
      i.cantidad,
      i.cantidad_pendiente,
      i.importe_total,
      i.importe_unitario,
      i.estado,
      i.fecha_registro,
      i.observaciones,
      t.nombre AS tipo_envase
    FROM importes_envases i
    INNER JOIN tipos_envase t
      ON t.id = i.tipo_envase_id
    WHERE i.tienda_id = ?
    AND i.estado = 'pendiente'
    ORDER BY i.fecha_registro DESC
  `;

  db.all(query, [tienda_id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener importes",
        detalle: error.message
      });
    }

    res.json(rows);
  });
};

const devolverImporte = (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  if (!cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({
      error: "Cantidad inválida",
    });
  }

  db.get(
    `
    SELECT *
    FROM importes_envases
    WHERE id = ?
    `,
    [id],
    (error, importe) => {
      if (error || !importe) {
        return res.status(404).json({
          error: "Importe no encontrado",
        });
      }

      const cantidadNumero = Number(cantidad);

      if (!Number.isInteger(cantidadNumero)) {
  return res.status(400).json({
    error: "La cantidad de envases debe ser entera",
  });
}

      if (cantidadNumero > importe.cantidad_pendiente) {
        return res.status(400).json({
          error: "Cantidad excede pendientes",
        });
      }



      const nuevaCantidad = importe.cantidad_pendiente - cantidadNumero;

      const nuevoEstado =
        nuevaCantidad <= 0
          ? "completado"
          : "pendiente";

      const montoDevolver =
        cantidadNumero * Number(importe.importe_unitario);

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const rollbackImporte = (mensaje) => {
          db.run("ROLLBACK", () => {
            return res.status(500).json({
              error: mensaje,
            });
          });
        };

        const registrarInventarioEnvase = () => {
          db.run(
            `
            INSERT INTO inventario_envases (
              tienda_id,
              tipo_envase_id,
              cantidad_vacios
            )
            VALUES (?, ?, ?)
            ON CONFLICT(tienda_id, tipo_envase_id)
            DO UPDATE SET
              cantidad_vacios =
                cantidad_vacios + excluded.cantidad_vacios
            `,
            [
              importe.tienda_id,
              importe.tipo_envase_id,
              cantidadNumero,
            ],
            (errorInventario) => {
              if (errorInventario) {
                return rollbackImporte("Error al actualizar inventario de envases");
              }

              db.run("COMMIT", (errorCommit) => {
                if (errorCommit) {
                  return rollbackImporte("Error al confirmar recepción de envases");
                }

                return res.json({
                  mensaje: "Envases recibidos correctamente",
                });
              });
            }
          );
        };

        const registrarMovimientoRelacionado = () => {
          if (importe.escenario === "dejo_importe") {
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
                importe.tienda_id,
                req.usuario.id,
                "salida_dinero",
                montoDevolver,
                "Devolución importe",
                importe.cliente,
              ],
              (errorCaja) => {
                if (errorCaja) {
                  return rollbackImporte("Error al registrar salida de dinero");
                }

                registrarInventarioEnvase();
              }
            );

            return;
          }

if (importe.escenario === "envase_prestado") {
  if (!importe.cliente_fiado_id) {
    registrarInventarioEnvase();
    return;
  }

  db.run(
    `
    INSERT INTO abonos_fiado (
      cliente_id,
      usuario_id,
      tienda_id,
      monto,
      observaciones
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      importe.cliente_fiado_id,
      req.usuario.id,
      importe.tienda_id,
      montoDevolver,
      `Recepción de envase prestado: ${importe.cliente}`,
    ],
    (errorAbono) => {
      if (errorAbono) {
        return rollbackImporte("Error al descontar deuda del cliente");
      }

      registrarInventarioEnvase();
    }
  );

  return;
}

          registrarInventarioEnvase();
        };

        db.run(
          `
          UPDATE importes_envases
          SET
            cantidad_pendiente = ?,
            estado = ?
          WHERE id = ?
          `,
          [
            nuevaCantidad,
            nuevoEstado,
            id,
          ],
          (errorUpdate) => {
            if (errorUpdate) {
              return rollbackImporte("Error al actualizar importe");
            }

            registrarMovimientoRelacionado();
          }
        );
      });
    }
  );
};
const obtenerInventarioEnvases = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT
      t.id,
      t.categoria,
      t.nombre,
      t.importe,
      COALESCE(i.cantidad_vacios, 0) AS cantidad_vacios
    FROM tipos_envase t
    LEFT JOIN inventario_envases i
      ON i.tipo_envase_id = t.id
      AND i.tienda_id = ?
    WHERE t.activo = 1
    ORDER BY t.categoria, t.nombre
  `;

  db.all(query, [tienda_id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener inventario de envases",
        detalle: error.message
      });
    }

    res.json(rows);
  });
};

module.exports = {
  obtenerTiposEnvase,
  registrarImporte,
  obtenerImportes,
  devolverImporte,
  obtenerInventarioEnvases,
};