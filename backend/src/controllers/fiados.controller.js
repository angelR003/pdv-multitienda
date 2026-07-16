const db = require("../database/connection");
const {
  redondearCentavos,
  derivarEstadoCuenta,
  agregarEstadoCuenta,
} = require("../services/cuentaCliente.service");
const {
  calcularHuellaPayloadAbono,
  normalizarOperationId,
  normalizarPayloadAbono,
  parsearRespuestaOperacion,
} = require("../services/idempotenciaAbonos.service");

const FILTRO_DEUDAS_ENVASE = `
  AND f.concepto NOT LIKE 'Envase prestado - %'
`;

const FILTRO_ABONOS_ENVASE = `
  AND COALESCE(a.observaciones, '') NOT LIKE 'Recepción de envase prestado:%'
  AND COALESCE(a.observaciones, '') NOT LIKE 'Recepcion de envase prestado:%'
  AND COALESCE(a.observaciones, '') NOT LIKE 'Cancelacion de envase por devolucion%'
`;

const calcularEstadoCliente = (clienteId, callback) => {
  db.get(
    `
    SELECT
      c.activo,
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
      ), 0) AS deuda_total,

      COALESCE((
        SELECT SUM(i.cantidad_pendiente)
        FROM importes_envases i
        WHERE i.cliente_fiado_id = c.id
        AND i.escenario = 'envase_prestado'
        AND i.estado = 'pendiente'
      ), 0) AS envases_pendientes
    FROM clientes_fiado c
    WHERE c.id = ?
    `,
    [clienteId],
    (error, fila) => {
      callback(error, error ? null : agregarEstadoCuenta(fila));
    }
  );
};

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

const actualizarClienteFiado = (req, res) => {
  const { id } = req.params;
  const {
    nombre_completo,
    apodo,
    telefono,
    limite_credito,
  } = req.body;

  const nombre = String(nombre_completo || "").trim();

  if (!nombre) {
    return res.status(400).json({
      error: "Nombre obligatorio",
    });
  }

  db.run(
    `
    UPDATE clientes_fiado
    SET
      nombre_completo = ?,
      apodo = ?,
      telefono = ?,
      limite_credito = ?
    WHERE id = ?
    AND activo = 1
    `,
    [
      nombre,
      String(apodo || "").trim() || null,
      String(telefono || "").trim() || null,
      Number(limite_credito) || 0,
      id,
    ],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al actualizar cliente",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Cliente no encontrado o inactivo",
        });
      }

      res.json({
        mensaje: "Cliente actualizado correctamente",
      });
    }
  );
};

const desactivarClienteFiado = (req, res) => {
  const { id } = req.params;

  calcularEstadoCliente(id, (errorEstado, estadoCliente) => {
    if (errorEstado) {
      return res.status(500).json({
        error: "Error al validar cliente",
      });
    }

    if (!estadoCliente) {
      return res.status(404).json({
        error: "Cliente no encontrado",
      });
    }

    const saldoDeudor = Number(estadoCliente.saldo_deudor || 0);
    const saldoAFavor = Number(estadoCliente.saldo_a_favor || 0);
    const envasesPendientes = Number(estadoCliente.envases_pendientes || 0);

    if (saldoDeudor > 0) {
      return res.status(400).json({
        error: "No puedes desactivar un cliente con saldo fiado pendiente",
      });
    }

    if (saldoAFavor > 0) {
      return res.status(400).json({
        error: "No puedes desactivar un cliente con saldo a favor",
      });
    }

    if (envasesPendientes > 0) {
      return res.status(400).json({
        error: "No puedes desactivar un cliente con envases pendientes",
      });
    }

    db.run(
      `
      UPDATE clientes_fiado
      SET activo = 0
      WHERE id = ?
      AND activo = 1
      `,
      [id],
      function (errorUpdate) {
        if (errorUpdate) {
          return res.status(500).json({
            error: "Error al desactivar cliente",
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            error: "Cliente no encontrado o ya inactivo",
          });
        }

        res.json({
          mensaje: "Cliente desactivado correctamente",
        });
      }
    );
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

    res.json(rows.map(agregarEstadoCuenta));
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
    confirmar_saldo_a_favor,
    operation_id,
  } = req.body;

  const montoNumero = Number(monto);
  let operationId;

  try {
    operationId = normalizarOperationId(operation_id);
  } catch (errorOperacion) {
    return res.status(errorOperacion.status || 400).json({
      error: errorOperacion.message,
      codigo: errorOperacion.codigo,
    });
  }

  if (
    !cliente_id ||
    !Number.isFinite(montoNumero) ||
    montoNumero <= 0
  ) {
    return res.status(400).json({
      error: "Datos inválidos",
    });
  }

  const payloadOperacion = normalizarPayloadAbono({
    cliente_id,
    usuario_id,
    tienda_id,
    monto: montoNumero,
    observaciones,
  });
  const huellaPayload = calcularHuellaPayloadAbono(payloadOperacion);

  db.serialize(() => {
    const responderConRollback = (status, payload) => {
      db.run("ROLLBACK", () => {
        res.status(status).json(payload);
      });
    };

    db.run("BEGIN IMMEDIATE TRANSACTION", (errorTransaccion) => {
      if (errorTransaccion) {
        return res.status(409).json({
          error: "Hay otra operación de fiado en proceso. Intenta de nuevo.",
        });
      }

      db.get(
        `
          SELECT operation_id, payload_hash, respuesta_json
          FROM operaciones_abono_fiado
          WHERE operation_id = ?
        `,
        [operationId],
        (errorOperacion, operacionExistente) => {
          if (errorOperacion) {
            const faltaMigracion = /no such table/i.test(errorOperacion.message);
            return responderConRollback(faltaMigracion ? 503 : 500, {
              error: faltaMigracion
                ? "Falta desplegar la tabla de idempotencia de abonos"
                : "Error al consultar la operacion de abono",
              codigo: faltaMigracion
                ? "MIGRACION_IDEMPOTENCIA_PENDIENTE"
                : "ERROR_IDEMPOTENCIA_ABONO",
            });
          }

          if (operacionExistente) {
            if (operacionExistente.payload_hash !== huellaPayload) {
              return responderConRollback(409, {
                error: "operation_id ya fue utilizado con datos diferentes",
                codigo: "OPERATION_ID_REUTILIZADO",
              });
            }

            const respuestaPrevia = parsearRespuestaOperacion(
              operacionExistente.respuesta_json
            );

            if (!respuestaPrevia) {
              return responderConRollback(500, {
                error: "La operacion previa no tiene una respuesta valida",
                codigo: "RESPUESTA_IDEMPOTENTE_INVALIDA",
              });
            }

            return responderConRollback(200, {
              ...respuestaPrevia,
              idempotente: true,
            });
          }

          calcularEstadoCliente(cliente_id, (errorEstado, estadoCliente) => {
        if (errorEstado) {
          return responderConRollback(500, {
            error: "Error al validar el saldo del cliente",
          });
        }

        if (!estadoCliente || Number(estadoCliente.activo) !== 1) {
          return responderConRollback(404, {
            error: "Cliente no encontrado o inactivo",
          });
        }

        const saldoResultante = redondearCentavos(
          estadoCliente.saldo_neto - montoNumero
        );
        const resumenResultante = derivarEstadoCuenta(saldoResultante);

        if (
          resumenResultante.saldo_a_favor > 0 &&
          confirmar_saldo_a_favor !== true
        ) {
          return responderConRollback(409, {
            error: "El abono generará saldo a favor y requiere confirmación",
            codigo: "CONFIRMACION_SALDO_A_FAVOR_REQUERIDA",
            requiere_confirmacion: true,
            monto_abono: redondearCentavos(montoNumero),
            saldo_actual: {
              saldo_neto: estadoCliente.saldo_neto,
              saldo_deudor: estadoCliente.saldo_deudor,
              saldo_a_favor: estadoCliente.saldo_a_favor,
              estado_cuenta: estadoCliente.estado_cuenta,
            },
            saldo_resultante: resumenResultante,
          });
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
            cliente_id,
            usuario_id,
            tienda_id,
            montoNumero,
            payloadOperacion.observaciones,
          ],
          function (errorAbono) {
            if (errorAbono) {
              return responderConRollback(500, {
                error: "Error al registrar abono",
              });
            }

            const abonoId = this.lastID;

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
                usuario_id,
                "entrada_dinero",
                montoNumero,
                "Abono de fiado",
                observaciones || null,
              ],
              function (errorCaja) {
                if (errorCaja) {
                  return responderConRollback(500, {
                    error: "Error al registrar abono",
                  });
                }

                const movimientoCajaId = this.lastID;
                const respuestaOperacion = {
                  mensaje: "Abono registrado",
                  id: abonoId,
                  operation_id: operationId,
                  idempotente: false,
                  ...resumenResultante,
                };

                db.run(
                  `
                    INSERT INTO operaciones_abono_fiado (
                      operation_id,
                      payload_hash,
                      cliente_id,
                      abono_id,
                      movimiento_caja_id,
                      respuesta_json
                    ) VALUES (?, ?, ?, ?, ?, ?)
                  `,
                  [
                    operationId,
                    huellaPayload,
                    payloadOperacion.cliente_id,
                    abonoId,
                    movimientoCajaId,
                    JSON.stringify(respuestaOperacion),
                  ],
                  (errorRegistroOperacion) => {
                    if (errorRegistroOperacion) {
                      return responderConRollback(500, {
                        error: "Error al registrar idempotencia del abono",
                      });
                    }

                    db.run("COMMIT", (errorCommit) => {
                      if (errorCommit) {
                        return responderConRollback(500, {
                          error: "Error al confirmar el abono",
                        });
                      }

                      res.json(respuestaOperacion);
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
  actualizarClienteFiado,
  desactivarClienteFiado,
  registrarFiado,
  registrarAbono,
  obtenerHistorialCliente,
};
