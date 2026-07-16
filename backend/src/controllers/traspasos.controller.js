const db = require("../database/connection");
const {
  calcularDisponibilidadComercial,
  consultarSaldo,
  descontarInventario,
  resolverMovimiento,
  sumarInventario,
} = require("../services/inventarioFisico.service");

function esAdmin(req) {
  return req.usuario?.rol === "administrador";
}

function validarCantidadProducto(producto, cantidad) {
  const cantidadNumero = Number(cantidad);

  if (!cantidadNumero || cantidadNumero <= 0) {
    return "Cantidad inválida";
  }

  const permiteDecimal =
    producto.tipo_producto === "peso_variable" ||
    Number(producto.es_derivado || 0) === 1;

  if (!permiteDecimal && !Number.isInteger(cantidadNumero)) {
    return `La cantidad de ${producto.nombre} debe ser entera`;
  }

  return null;
}

const obtenerTiendas = (req, res) => {
  db.all(
    `
    SELECT id, nombre, ubicacion
    FROM tiendas
    WHERE activa = 1
    ORDER BY nombre ASC
    `,
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Error al obtener tiendas" });
      }

      res.json(rows);
    }
  );
};

const obtenerProductosParaTraspaso = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({ error: "tienda_id es obligatorio" });
  }

  db.all(
    `
    SELECT
      p.id,
      p.nombre,
      p.codigo_barras,
      NULLIF(p.marca, '[object Object]') AS marca,
      NULLIF(p.categoria, '[object Object]') AS categoria,
      p.tipo_producto,
      p.unidad,
      p.es_derivado,
      p.producto_padre_id,
      p.factor_conversion,
      CASE
        WHEN p.es_derivado = 1 THEN p.producto_padre_id
        ELSE p.id
      END AS producto_fisico_id,
      COALESCE(i.cantidad_actual, 0) AS cantidad_fisica_actual,
      COALESCE(i_hijo.cantidad_actual, 0) AS cantidad_legacy_hijo
    FROM productos p
    LEFT JOIN inventario i
      ON i.producto_id = CASE
        WHEN p.es_derivado = 1 THEN p.producto_padre_id
        ELSE p.id
      END
      AND i.tienda_id = ?
    LEFT JOIN inventario i_hijo
      ON i_hijo.producto_id = p.id
      AND i_hijo.tienda_id = ?
      AND p.es_derivado = 1
    WHERE p.activo = 1
    ORDER BY p.nombre ASC
    `,
    [tienda_id, tienda_id],
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Error al obtener productos" });
      }

      const productos = rows.map((producto) => {
        const esDerivado = Number(producto.es_derivado || 0) === 1;
        let cantidadActual = Number(producto.cantidad_fisica_actual || 0);

        if (esDerivado) {
          try {
            cantidadActual = calcularDisponibilidadComercial(
              producto.cantidad_fisica_actual,
              producto.factor_conversion
            );
          } catch (errorFactor) {
            cantidadActual = 0;
          }
        }

        return {
          ...producto,
          cantidad_actual: cantidadActual,
          inventario_autoritativo: "fisico",
          diagnostico_fila_hijo:
            esDerivado && Number(producto.cantidad_legacy_hijo || 0) !== 0
              ? `Fila legacy no autoritativa: ${producto.cantidad_legacy_hijo}`
              : null,
        };
      });

      res.json(productos);
    }
  );
};

const obtenerNotificacionesTraspasos = (req, res) => {
  const params = [];
  let filtro = "WHERE tr.estado = 'enviado'";

  if (!esAdmin(req)) {
    filtro += " AND tr.tienda_destino_id = ?";
    params.push(req.usuario.tienda_id);
  }

  db.all(
    `
    SELECT
      tr.id,
      tr.estado,
      tr.fecha_envio,
      origen.nombre AS tienda_origen,
      destino.nombre AS tienda_destino,
      u.nombre AS usuario,
      COUNT(td.id) AS total_productos,
      GROUP_CONCAT(p.nombre || ' x ' || td.cantidad, ', ') AS resumen_productos
    FROM traspasos tr
    INNER JOIN tiendas origen ON origen.id = tr.tienda_origen_id
    INNER JOIN tiendas destino ON destino.id = tr.tienda_destino_id
    INNER JOIN usuarios u ON u.id = tr.usuario_id
    INNER JOIN traspaso_detalles td ON td.traspaso_id = tr.id
    INNER JOIN productos p ON p.id = td.producto_id
    ${filtro}
    GROUP BY tr.id
    ORDER BY tr.fecha_envio DESC
    `,
    params,
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Error al obtener notificaciones" });
      }

      res.json(rows);
    }
  );
};

const listarTraspasos = (req, res) => {
  const params = [];
  let filtro = "";

  if (!esAdmin(req)) {
    filtro = "WHERE tr.tienda_destino_id = ?";
    params.push(req.usuario.tienda_id);
  }

  db.all(
    `
    SELECT
      tr.id,
      tr.estado,
      tr.motivo,
      tr.fecha_envio,
      tr.fecha_recepcion,
      origen.nombre AS tienda_origen,
      destino.nombre AS tienda_destino,
      u.nombre AS usuario
    FROM traspasos tr
    INNER JOIN tiendas origen ON origen.id = tr.tienda_origen_id
    INNER JOIN tiendas destino ON destino.id = tr.tienda_destino_id
    INNER JOIN usuarios u ON u.id = tr.usuario_id
    ${filtro}
    ORDER BY tr.fecha_envio DESC
    `,
    params,
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Error al listar traspasos" });
      }

      res.json(rows);
    }
  );
};

const obtenerTraspasoPorId = (req, res) => {
  const { id } = req.params;

  db.get(
    `
    SELECT
      tr.id,
      tr.tienda_origen_id,
      tr.tienda_destino_id,
      tr.usuario_id,
      tr.motivo,
      tr.estado,
      tr.fecha_envio,
      tr.fecha_recepcion,
      origen.nombre AS tienda_origen,
      destino.nombre AS tienda_destino,
      u.nombre AS usuario
    FROM traspasos tr
    INNER JOIN tiendas origen ON origen.id = tr.tienda_origen_id
    INNER JOIN tiendas destino ON destino.id = tr.tienda_destino_id
    INNER JOIN usuarios u ON u.id = tr.usuario_id
    WHERE tr.id = ?
    `,
    [id],
    (error, traspaso) => {
      if (error) {
        return res.status(500).json({ error: "Error al obtener traspaso" });
      }

      if (!traspaso) {
        return res.status(404).json({ error: "Traspaso no encontrado" });
      }

      if (!esAdmin(req) && Number(traspaso.tienda_destino_id) !== Number(req.usuario.tienda_id)) {
        return res.status(403).json({ error: "No tienes acceso a este traspaso" });
      }

      db.all(
        `
        SELECT
          td.id,
          td.producto_id,
          td.cantidad,
          p.nombre AS producto,
          p.codigo_barras,
          p.tipo_producto,
          p.unidad
        FROM traspaso_detalles td
        INNER JOIN productos p ON p.id = td.producto_id
        WHERE td.traspaso_id = ?
        ORDER BY p.nombre ASC
        `,
        [id],
        (errorDetalles, detalles) => {
          if (errorDetalles) {
            return res.status(500).json({ error: "Error al obtener detalles" });
          }

          res.json({
            traspaso,
            detalles,
          });
        }
      );
    }
  );
};

const crearTraspaso = (req, res) => {
  if (!esAdmin(req)) {
    return res.status(403).json({
      error: "Solo administradores pueden crear traspasos",
    });
  }

  const {
    tienda_origen_id,
    tienda_destino_id,
    motivo,
    productos,
  } = req.body;

  if (
    !tienda_origen_id ||
    !tienda_destino_id ||
    Number(tienda_origen_id) === Number(tienda_destino_id)
  ) {
    return res.status(400).json({
      error: "Origen y destino son obligatorios y deben ser diferentes",
    });
  }

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({
      error: "Agrega al menos un producto al traspaso",
    });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const rollback = (mensaje) => {
      db.run("ROLLBACK", () => {
        return res.status(400).json({ error: mensaje });
      });
    };

    const detallesValidados = [];

    const validarProducto = (index) => {
      if (index >= productos.length) {
        guardarTraspaso();
        return;
      }

      const item = productos[index];
      const productoId = Number(item.producto_id);
      const cantidad = Number(item.cantidad);

      if (!productoId || !cantidad || cantidad <= 0) {
        return rollback("Producto o cantidad inválida");
      }

      resolverMovimiento(productoId, cantidad, {}, (errorImpacto, impacto) => {
          if (errorImpacto) {
            return rollback(errorImpacto.message);
          }

          const errorCantidad = validarCantidadProducto(
            impacto.producto,
            cantidad
          );

          if (errorCantidad) {
            return rollback(errorCantidad);
          }

          consultarSaldo(
            tienda_origen_id,
            impacto.producto_fisico_id,
            (errorInventario, inventario) => {
              if (errorInventario) {
                return rollback("Error al consultar inventario");
              }

              if (
                !inventario ||
                Number(inventario.cantidad_actual) + 1e-9 <
                  Number(impacto.cantidad_fisica)
              ) {
                return rollback(
                  `Inventario insuficiente para ${impacto.producto_comercial_nombre}`
                );
              }

              detallesValidados.push({
                producto_id: impacto.producto_comercial_id,
                producto_inventario_id: impacto.producto_fisico_id,
                cantidad,
                cantidad_inventario: impacto.cantidad_fisica,
                impacto,
              });

              validarProducto(index + 1);
            }
          );
        });
    };

    const guardarTraspaso = () => {
      db.run(
        `
        INSERT INTO traspasos (
          tienda_origen_id,
          tienda_destino_id,
          usuario_id,
          motivo,
          estado
        )
        VALUES (?, ?, ?, ?, 'enviado')
        `,
        [
          tienda_origen_id,
          tienda_destino_id,
          req.usuario.id,
          motivo || null,
        ],
        function (errorTraspaso) {
          if (errorTraspaso) {
            return rollback("Error al crear traspaso");
          }

          const traspasoId = this.lastID;
          guardarDetalles(traspasoId, 0);
        }
      );
    };

    const guardarDetalles = (traspasoId, index) => {
      if (index >= detallesValidados.length) {
        db.run("COMMIT", (errorCommit) => {
          if (errorCommit) {
            return rollback("Error al confirmar traspaso");
          }

          return res.status(201).json({
            mensaje: "Traspaso enviado correctamente",
            traspaso_id: traspasoId,
          });
        });

        return;
      }

      const detalle = detallesValidados[index];

      db.run(
        `
        INSERT INTO traspaso_detalles (
          traspaso_id,
          producto_id,
          cantidad
        )
        VALUES (?, ?, ?)
        `,
        [
          traspasoId,
          detalle.producto_id,
          detalle.cantidad,
        ],
        (errorDetalle) => {
          if (errorDetalle) {
            return rollback("Error al guardar detalle de traspaso");
          }

          descontarInventario(
            tienda_origen_id,
            detalle.impacto,
            (errorDescuento) => {
              if (errorDescuento) {
                return rollback(errorDescuento.message || "Error al descontar inventario origen");
              }

              guardarDetalles(traspasoId, index + 1);
            }
          );
        }
      );
    };

    validarProducto(0);
  });
};

const recibirTraspaso = (req, res) => {
  const { id } = req.params;

  db.get(
    `
    SELECT *
    FROM traspasos
    WHERE id = ?
    `,
    [id],
    (error, traspaso) => {
      if (error) {
        return res.status(500).json({ error: "Error al consultar traspaso" });
      }

      if (!traspaso) {
        return res.status(404).json({ error: "Traspaso no encontrado" });
      }

      if (traspaso.estado !== "enviado") {
        return res.status(400).json({ error: "Solo se pueden recibir traspasos enviados" });
      }

      if (!esAdmin(req) && Number(traspaso.tienda_destino_id) !== Number(req.usuario.tienda_id)) {
        return res.status(403).json({ error: "Solo la tienda destino puede recibir este traspaso" });
      }

      db.all(
        `
        SELECT
          td.producto_id,
          td.cantidad,
          p.es_derivado,
          p.producto_padre_id,
          p.factor_conversion
        FROM traspaso_detalles td
        INNER JOIN productos p ON p.id = td.producto_id
        WHERE td.traspaso_id = ?
        `,
        [id],
        (errorDetalles, detalles) => {
          if (errorDetalles) {
            return res.status(500).json({ error: "Error al obtener detalles" });
          }

          db.serialize(() => {
            const rollback = (mensaje) => {
              db.run("ROLLBACK", () => {
                return res.status(400).json({ error: mensaje });
              });
            };

            const sumarDetalle = (index) => {
              if (index >= detalles.length) {
                db.run(
                  `
                  UPDATE traspasos
                  SET
                    estado = 'recibido',
                    fecha_recepcion = CURRENT_TIMESTAMP
                  WHERE id = ? AND estado = 'enviado'
                  `,
                  [id],
                  function (errorUpdate) {
                    if (errorUpdate) {
                      return rollback("Error al actualizar estado del traspaso");
                    }

                    if (this.changes !== 1) {
                      return rollback("El traspaso ya no esta disponible para recibir");
                    }

                    db.run("COMMIT", (errorCommit) => {
                      if (errorCommit) {
                        return rollback("Error al confirmar recepción");
                      }

                      return res.json({
                        mensaje: "Traspaso recibido correctamente",
                      });
                    });
                  }
                );

                return;
              }

              const detalle = detalles[index];

              resolverMovimiento(
                detalle.producto_id,
                detalle.cantidad,
                { permitirInactivo: true },
                (errorImpacto, impacto) => {
                  if (errorImpacto) return rollback(errorImpacto.message);

                  sumarInventario(
                    traspaso.tienda_destino_id,
                    impacto,
                    (errorInventario) => {
                      if (errorInventario) {
                        return rollback("Error al sumar inventario destino");
                      }

                      sumarDetalle(index + 1);
                    }
                  );
                }
              );
            };

            db.run("BEGIN IMMEDIATE TRANSACTION", (errorInicio) => {
              if (errorInicio) {
                return res.status(409).json({
                  error: "Hay otra operacion de traspaso en proceso",
                });
              }

              sumarDetalle(0);
            });
          });
        }
      );
    }
  );
};

const cancelarTraspaso = (req, res) => {
  if (!esAdmin(req)) {
    return res.status(403).json({
      error: "Solo administradores pueden cancelar traspasos",
    });
  }

  const { id } = req.params;

  db.get(
    `
    SELECT *
    FROM traspasos
    WHERE id = ?
    `,
    [id],
    (error, traspaso) => {
      if (error) {
        return res.status(500).json({ error: "Error al consultar traspaso" });
      }

      if (!traspaso) {
        return res.status(404).json({ error: "Traspaso no encontrado" });
      }

      if (traspaso.estado !== "enviado") {
        return res.status(400).json({ error: "Solo se pueden cancelar traspasos enviados" });
      }

      db.all(
        `
        SELECT
          td.producto_id,
          td.cantidad,
          p.es_derivado,
          p.producto_padre_id,
          p.factor_conversion
        FROM traspaso_detalles td
        INNER JOIN productos p ON p.id = td.producto_id
        WHERE td.traspaso_id = ?
        `,
        [id],
        (errorDetalles, detalles) => {
          if (errorDetalles) {
            return res.status(500).json({ error: "Error al obtener detalles" });
          }

          db.serialize(() => {
            const rollback = (mensaje) => {
              db.run("ROLLBACK", () => {
                return res.status(400).json({ error: mensaje });
              });
            };

            const regresarDetalle = (index) => {
              if (index >= detalles.length) {
                db.run(
                  `
                  UPDATE traspasos
                  SET estado = 'cancelado'
                  WHERE id = ? AND estado = 'enviado'
                  `,
                  [id],
                  function (errorUpdate) {
                    if (errorUpdate) {
                      return rollback("Error al cancelar traspaso");
                    }

                    if (this.changes !== 1) {
                      return rollback("El traspaso ya no esta disponible para cancelar");
                    }

                    db.run("COMMIT", (errorCommit) => {
                      if (errorCommit) {
                        return rollback("Error al confirmar cancelación");
                      }

                      return res.json({
                        mensaje: "Traspaso cancelado correctamente",
                      });
                    });
                  }
                );

                return;
              }

              const detalle = detalles[index];

              resolverMovimiento(
                detalle.producto_id,
                detalle.cantidad,
                { permitirInactivo: true },
                (errorImpacto, impacto) => {
                  if (errorImpacto) return rollback(errorImpacto.message);

                  sumarInventario(
                    traspaso.tienda_origen_id,
                    impacto,
                    (errorInventario) => {
                      if (errorInventario) {
                        return rollback("Error al regresar inventario origen");
                      }

                      regresarDetalle(index + 1);
                    }
                  );
                }
              );
            };

            db.run("BEGIN IMMEDIATE TRANSACTION", (errorInicio) => {
              if (errorInicio) {
                return res.status(409).json({
                  error: "Hay otra operacion de traspaso en proceso",
                });
              }

              regresarDetalle(0);
            });
          });
        }
      );
    }
  );
};

module.exports = {
  obtenerTiendas,
  obtenerProductosParaTraspaso,
  obtenerNotificacionesTraspasos,
  listarTraspasos,
  obtenerTraspasoPorId,
  crearTraspaso,
  recibirTraspaso,
  cancelarTraspaso,
};
