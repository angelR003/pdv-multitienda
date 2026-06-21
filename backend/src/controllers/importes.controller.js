const db = require("../database/connection");
const { calcularImporteEnvase } = require("../utils/importes-envases");

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
          ? calcularImporteEnvase(tipoEnvase, cantidadNumero)
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
  const { tienda_id, todas } = req.query;
  const verTodas = todas === "1" && req.usuario.rol === "administrador";

  if (!tienda_id && !verTodas) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const params = [];
  const filtroTienda = verTodas ? "" : "AND i.tienda_id = ?";

  if (!verTodas) {
    params.push(tienda_id);
  }

  const query = `
    SELECT
      i.id,
      i.tienda_id,
      ti.nombre AS tienda,
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
    INNER JOIN tiendas ti
      ON ti.id = i.tienda_id
    WHERE 1 = 1
    ${filtroTienda}
    AND i.estado = 'pendiente'
    ORDER BY i.fecha_registro DESC
  `;

  db.all(query, params, (error, rows) => {
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
    SELECT
      i.*,
      t.categoria,
      t.importe,
      t.cantidad_por_caja,
      t.importe_por_caja
    FROM importes_envases i
    INNER JOIN tipos_envase t
      ON t.id = i.tipo_envase_id
    WHERE i.id = ?
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
        importe.escenario === "dejo_importe"
          ? (Number(importe.importe_total || 0) / Number(importe.cantidad || 1)) *
            cantidadNumero
          : 0;

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
            registrarInventarioEnvase();
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
      t.cantidad_por_caja,
      t.importe_por_caja,
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

const actualizarConfiguracionCajaEnvase = (req, res) => {
  const { id } = req.params;
  const {
    cantidad_por_caja,
    importe_por_caja,
  } = req.body;

  const cantidadPorCaja = cantidad_por_caja === "" || cantidad_por_caja == null
    ? null
    : Number(cantidad_por_caja);
  const importePorCaja = importe_por_caja === "" || importe_por_caja == null
    ? null
    : Number(importe_por_caja);

  if (
    cantidadPorCaja != null &&
    (!Number.isInteger(cantidadPorCaja) || cantidadPorCaja <= 0)
  ) {
    return res.status(400).json({
      error: "La cantidad por caja debe ser un entero mayor a 0",
    });
  }

  if (importePorCaja != null && importePorCaja <= 0) {
    return res.status(400).json({
      error: "El importe por caja debe ser mayor a 0",
    });
  }

  db.run(
    `
    UPDATE tipos_envase
    SET
      cantidad_por_caja = ?,
      importe_por_caja = ?
    WHERE id = ?
    AND activo = 1
    `,
    [cantidadPorCaja, importePorCaja, id],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al actualizar configuracion de caja",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Tipo de envase no encontrado",
        });
      }

      res.json({
        mensaje: "Configuracion de caja actualizada",
      });
    }
  );
};

const actualizarConfiguracionEnvase = (req, res) => {
  const { id } = req.params;
  const {
    importe,
    cantidad_por_caja,
    importe_por_caja,
  } = req.body;

  const importeUnitario = Number(importe);
  const cantidadPorCaja = cantidad_por_caja === "" || cantidad_por_caja == null
    ? null
    : Number(cantidad_por_caja);
  const importePorCaja = importe_por_caja === "" || importe_por_caja == null
    ? null
    : Number(importe_por_caja);

  if (!Number.isFinite(importeUnitario) || importeUnitario <= 0) {
    return res.status(400).json({
      error: "El importe unitario debe ser mayor a 0",
    });
  }

  if (
    cantidadPorCaja != null &&
    (!Number.isInteger(cantidadPorCaja) || cantidadPorCaja <= 0)
  ) {
    return res.status(400).json({
      error: "La cantidad por caja debe ser un entero mayor a 0",
    });
  }

  if (importePorCaja != null && importePorCaja <= 0) {
    return res.status(400).json({
      error: "El importe por caja debe ser mayor a 0",
    });
  }

  if ((cantidadPorCaja == null) !== (importePorCaja == null)) {
    return res.status(400).json({
      error: "Captura cantidad e importe por caja, o deja ambos vacios",
    });
  }

  db.run(
    `
    UPDATE tipos_envase
    SET
      importe = ?,
      cantidad_por_caja = ?,
      importe_por_caja = ?
    WHERE id = ?
    AND activo = 1
    `,
    [importeUnitario, cantidadPorCaja, importePorCaja, id],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al actualizar importes del envase",
          detalle: error.message,
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Tipo de envase no encontrado",
        });
      }

      return res.json({
        mensaje: "Importes del envase actualizados correctamente",
      });
    }
  );
};

const motivosAjusteEnvaseValidos = [
  "Carga inicial",
  "Entregado a proveedor",
  "Enviado a otra tienda",
  "Recibido de otra tienda",
  "Correccion de conteo",
  "Merma/perdida",
  "Otro",
];

const registrarAjusteEnvases = (req, res) => {
  const {
    tienda_id,
    tipo_envase_id,
    modo,
    cantidad,
    motivo,
    observaciones,
  } = req.body;

  const tiendaId = Number(tienda_id);
  const tipoEnvaseId = Number(tipo_envase_id);
  const cantidadNumero = Number(cantidad);

  if (
    !tiendaId ||
    !tipoEnvaseId ||
    !["sumar", "restar", "definir"].includes(modo) ||
    cantidad == null ||
    !motivo
  ) {
    return res.status(400).json({
      error: "Datos incompletos para ajustar envases",
    });
  }

  if (!Number.isInteger(cantidadNumero) || cantidadNumero < 0) {
    return res.status(400).json({
      error: "La cantidad debe ser un numero entero positivo",
    });
  }

  if (modo !== "definir" && cantidadNumero <= 0) {
    return res.status(400).json({
      error: "La cantidad debe ser mayor a 0",
    });
  }

  if (!motivosAjusteEnvaseValidos.includes(motivo)) {
    return res.status(400).json({
      error: "Motivo de ajuste invalido",
    });
  }

  db.get(
    `
    SELECT id
    FROM tipos_envase
    WHERE id = ?
    AND activo = 1
    `,
    [tipoEnvaseId],
    (errorTipo, tipoEnvase) => {
      if (errorTipo) {
        return res.status(500).json({
          error: "Error al validar tipo de envase",
        });
      }

      if (!tipoEnvase) {
        return res.status(404).json({
          error: "Tipo de envase no encontrado",
        });
      }

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const rollbackAjuste = (mensaje, detalle) => {
          db.run("ROLLBACK", () => {
            return res.status(500).json({
              error: mensaje,
              detalle,
            });
          });
        };

        db.get(
          `
          SELECT cantidad_vacios
          FROM inventario_envases
          WHERE tienda_id = ?
          AND tipo_envase_id = ?
          `,
          [tiendaId, tipoEnvaseId],
          (errorInventario, inventario) => {
            if (errorInventario) {
              return rollbackAjuste(
                "Error al consultar inventario de envases",
                errorInventario.message
              );
            }

            const cantidadAnterior = Number(inventario?.cantidad_vacios || 0);
            let cantidadNueva = cantidadAnterior;

            if (modo === "sumar") {
              cantidadNueva = cantidadAnterior + cantidadNumero;
            }

            if (modo === "restar") {
              cantidadNueva = cantidadAnterior - cantidadNumero;
            }

            if (modo === "definir") {
              cantidadNueva = cantidadNumero;
            }

            if (cantidadNueva < 0) {
              db.run("ROLLBACK", () => {
                return res.status(400).json({
                  error: "El ajuste no puede dejar envases negativos",
                });
              });
              return;
            }

            const diferencia = cantidadNueva - cantidadAnterior;

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
                cantidad_vacios = excluded.cantidad_vacios
              `,
              [tiendaId, tipoEnvaseId, cantidadNueva],
              (errorUpdate) => {
                if (errorUpdate) {
                  return rollbackAjuste(
                    "Error al actualizar inventario de envases",
                    errorUpdate.message
                  );
                }

                db.run(
                  `
                  INSERT INTO ajustes_envases (
                    tienda_id,
                    usuario_id,
                    tipo_envase_id,
                    cantidad_anterior,
                    cantidad_nueva,
                    diferencia,
                    modo,
                    motivo,
                    observaciones
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `,
                  [
                    tiendaId,
                    req.usuario.id,
                    tipoEnvaseId,
                    cantidadAnterior,
                    cantidadNueva,
                    diferencia,
                    modo,
                    motivo,
                    observaciones || null,
                  ],
                  function (errorAjuste) {
                    if (errorAjuste) {
                      return rollbackAjuste(
                        "Error al registrar historial de ajuste",
                        errorAjuste.message
                      );
                    }

                    db.run("COMMIT", (errorCommit) => {
                      if (errorCommit) {
                        return rollbackAjuste(
                          "Error al confirmar ajuste de envases",
                          errorCommit.message
                        );
                      }

                      return res.status(201).json({
                        mensaje: "Ajuste de envases realizado correctamente",
                        ajuste_id: this.lastID,
                        cantidad_anterior: cantidadAnterior,
                        cantidad_nueva: cantidadNueva,
                        diferencia,
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

const obtenerAjustesEnvases = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  db.all(
    `
    SELECT
      a.id,
      a.tienda_id,
      ti.nombre AS tienda,
      a.tipo_envase_id,
      te.categoria,
      te.nombre AS tipo_envase,
      u.nombre AS usuario,
      a.cantidad_anterior,
      a.cantidad_nueva,
      a.diferencia,
      a.modo,
      a.motivo,
      a.observaciones,
      a.fecha_ajuste
    FROM ajustes_envases a
    INNER JOIN tipos_envase te
      ON te.id = a.tipo_envase_id
    INNER JOIN tiendas ti
      ON ti.id = a.tienda_id
    INNER JOIN usuarios u
      ON u.id = a.usuario_id
    WHERE a.tienda_id = ?
    ORDER BY a.fecha_ajuste DESC
    LIMIT 25
    `,
    [tienda_id],
    (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener ajustes de envases",
          detalle: error.message,
        });
      }

      res.json(rows);
    }
  );
};

module.exports = {
  obtenerTiposEnvase,
  registrarImporte,
  obtenerImportes,
  devolverImporte,
  obtenerInventarioEnvases,
  actualizarConfiguracionCajaEnvase,
  actualizarConfiguracionEnvase,
  registrarAjusteEnvases,
  obtenerAjustesEnvases,
};
