const db = require("../database/connection");
const redondearAMedioPeso = (monto) => {
  return Math.round(monto * 2) / 2;
};

const calcularPromocionProducto = (cantidad, precioNormal, promocion) => {
  const cantidadNumero = Number(cantidad);
  const precioNormalNumero = Number(precioNormal);

  if (!promocion) {
    const subtotalNormal = cantidadNumero * precioNormalNumero;

    return {
      subtotal: subtotalNormal,
      precioUnitarioFinal: precioNormalNumero,
      precioUnitarioOriginal: precioNormalNumero,
      promocionId: null,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
    };
  }

  const cantidadRequerida = Number(promocion.cantidad_requerida);
  const precioPromocion = Number(promocion.precio_promocion);

  if (
    !Number.isInteger(cantidadNumero) ||
    cantidadNumero < cantidadRequerida ||
    cantidadRequerida < 2 ||
    precioPromocion <= 0
  ) {
    const subtotalNormal = cantidadNumero * precioNormalNumero;

    return {
      subtotal: subtotalNormal,
      precioUnitarioFinal: precioNormalNumero,
      precioUnitarioOriginal: precioNormalNumero,
      promocionId: null,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
    };
  }

  const gruposPromo = Math.floor(cantidadNumero / cantidadRequerida);
  const cantidadConPromo = gruposPromo * cantidadRequerida;
  const cantidadNormal = cantidadNumero - cantidadConPromo;

  const subtotalPromo = gruposPromo * precioPromocion;
  const subtotalNormalRestante = cantidadNormal * precioNormalNumero;

  const subtotalFinal = subtotalPromo + subtotalNormalRestante;
  const subtotalOriginal = cantidadNumero * precioNormalNumero;

  const descuentoPromocion = subtotalOriginal - subtotalFinal;
  const precioUnitarioFinal = subtotalFinal / cantidadNumero;

  return {
    subtotal: subtotalFinal,
    precioUnitarioFinal,
    precioUnitarioOriginal: precioNormalNumero,
    promocionId: promocion.id,
    cantidadPromocionAplicada: cantidadConPromo,
    descuentoPromocion,
  };
};

const escenariosEnvaseValidos = [
  "trajo_envase",
  "dejo_importe",
  "envase_prestado",
];
const registrarEnvasesVenta = ({ tienda_id, usuario_id, folio, envases }, callback) => {
  if (!Array.isArray(envases) || envases.length === 0) {
    callback();
    return;
  }

  const resolverClienteEnvase = (envase, callbackCliente) => {
        if (envase.escenario === "trajo_envase") {
      callbackCliente(null, {
        clienteFiadoId: null,
        clienteNombre: "Cliente mostrador",
      });
      return;
    }
    if (envase.cliente_fiado_id) {
      callbackCliente(null, {
        clienteFiadoId: envase.cliente_fiado_id,
        clienteNombre: envase.cliente,
      });
      return;
    }

    const nombreCliente = String(envase.cliente || "").trim();

    if (!nombreCliente) {
      callbackCliente("Cliente obligatorio para envase");
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
      [nombreCliente, null, null, 0],
      function (errorCliente) {
        if (errorCliente) {
          callbackCliente("Error al crear cliente para envase");
          return;
        }

        callbackCliente(null, {
          clienteFiadoId: this.lastID,
          clienteNombre: nombreCliente,
        });
      }
    );
  };

  const procesarEnvase = (index) => {
    if (index >= envases.length) {
      callback();
      return;
    }

    const envase = envases[index];

    db.get(
      `
      SELECT *
      FROM tipos_envase
      WHERE id = ?
      AND activo = 1
      `,
      [envase.tipo_envase_id],
      (errorTipo, tipoEnvase) => {
        if (errorTipo) {
          callback("Error al consultar tipo de envase");
          return;
        }

        if (!tipoEnvase) {
          callback("Tipo de envase no encontrado");
          return;
        }

        resolverClienteEnvase(envase, (errorCliente, clienteResuelto) => {
          if (errorCliente) {
            callback(errorCliente);
            return;
          }

          const cantidad = Number(envase.cantidad);
          const importeUnitario = Number(tipoEnvase.importe);
          const importeTotal =
            envase.escenario === "dejo_importe"
              ? importeUnitario * cantidad
              : 0;

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
              usuario_id,
              clienteResuelto.clienteNombre,
              clienteResuelto.clienteFiadoId,
              envase.tipo_envase_id,
              envase.escenario,
              cantidad,
              envase.escenario === "trajo_envase" ? 0 : cantidad,
              importeUnitario,
              importeTotal,
              envase.escenario === "trajo_envase" ? "completado" : "pendiente",
              `Venta ${folio} - ${envase.producto_nombre || "producto retornable"}`,
            ],
            (errorImporte) => {
              if (errorImporte) {
                callback("Error al registrar importe/envase");
                return;
              }

              if (envase.escenario === "dejo_importe") {
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
                    importeTotal,
                    "Importe envases",
                    clienteResuelto.clienteNombre,
                  ],
                  (errorCaja) => {
                    if (errorCaja) {
                      callback("Error al registrar movimiento de caja por envase");
                      return;
                    }

                    procesarEnvase(index + 1);
                  }
                );

                return;
              }

              if (envase.escenario === "envase_prestado") {
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
                    clienteResuelto.clienteFiadoId,
                    usuario_id,
                    tienda_id,
                    `Envase prestado - ${envase.producto_nombre || tipoEnvase.nombre}`,
                    importeUnitario * cantidad,
                  ],
                  (errorFiado) => {
                    if (errorFiado) {
                      callback("Error al registrar deuda de envase");
                      return;
                    }

                    procesarEnvase(index + 1);
                  }
                );

                return;
              }

              if (envase.escenario === "trajo_envase") {
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
                  [tienda_id, envase.tipo_envase_id, cantidad],
                  (errorInventarioEnvase) => {
                    if (errorInventarioEnvase) {
                      callback("Error al actualizar inventario de envases");
                      return;
                    }

                    procesarEnvase(index + 1);
                  }
                );

                return;
              }

              procesarEnvase(index + 1);
            }
          );
        });
      }
    );
  };

  procesarEnvase(0);
};
const crearVenta = (req, res) => {
    const {
    tienda_id,
    usuario_id,
    metodo_pago,
    productos,
    cliente_fiado_id,
    envases,
  } = req.body;

  const envasesVenta = Array.isArray(envases) ? envases : [];

  if (metodo_pago === "fiado" && !cliente_fiado_id) {
    return res.status(400).json({
      error: "Selecciona un cliente para fiado",
    });
  }

  if (
    !tienda_id ||
    !usuario_id ||
    !metodo_pago ||
    !Array.isArray(productos) ||
    productos.length === 0
  ) {
    return res.status(400).json({
      error: "Datos incompletos para registrar la venta",
    });
  }

  const folio = `V-${Date.now()}`;

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION", (errorTransaccion) => {
      if (errorTransaccion) {
        return res.status(409).json({
          error: "Hay otra venta en proceso. Intenta de nuevo.",
        });
      }

    let subtotalVenta = 0;
    const detalles = [];

    const procesarProducto = (index) => {
      if (index >= productos.length) {
        validarInventarioAgrupado();
        return;
      }

      const item = productos[index];
      const { producto_id, cantidad } = item;

      if (!producto_id || !cantidad || cantidad <= 0) {
        return rollback(res, "Producto inválido en la venta");
      }

      db.get(
        `
        SELECT 
  p.*,
  COALESCE(pt.precio_especial, p.precio_global) AS precio_aplicable
FROM productos p
LEFT JOIN precios_tienda pt
  ON pt.producto_id = p.id
  AND pt.tienda_id = ?
  AND pt.activo = 1
WHERE p.id = ?
AND p.activo = 1
LIMIT 1
        `,
        [tienda_id, producto_id],
            (error, producto) => {
          if (error) {
            return rollback(res, "Error al buscar producto");
          }

          if (!producto) {
            return rollback(res, "Producto no encontrado");
          }

          const cantidadVenta = Number(cantidad);

          if (!cantidadVenta || cantidadVenta <= 0) {
            return rollback(res, `Cantidad inválida para ${producto.nombre}`);
          }

          const permiteDecimal =
            producto.tipo_producto === "peso_variable" ||
            Number(producto.es_derivado || 0) === 1;

          if (!permiteDecimal && !Number.isInteger(cantidadVenta)) {
            return rollback(
              res,
              `La cantidad de ${producto.nombre} debe ser una pieza completa`
            );
          }

          if (Number(producto.es_retornable || 0) === 1) {
            const envaseVenta = envasesVenta.find(
              (envase) => Number(envase.producto_id) === Number(producto.id)
            );

            if (!envaseVenta) {
              return rollback(
                res,
                `Selecciona el escenario de envase para ${producto.nombre}`
              );
            }

            if (!escenariosEnvaseValidos.includes(envaseVenta.escenario)) {
              return rollback(res, "Escenario de envase inválido");
            }

            if (
              !envaseVenta.tipo_envase_id ||
              Number(envaseVenta.tipo_envase_id) !== Number(producto.tipo_envase_id)
            ) {
              return rollback(
                res,
                `Tipo de envase inválido para ${producto.nombre}`
              );
            }

            const cantidadEnvases = Number(envaseVenta.cantidad);

            if (
              !Number.isInteger(cantidadEnvases) ||
              cantidadEnvases <= 0 ||
              cantidadEnvases !== cantidadVenta
            ) {
              return rollback(
                res,
                `Cantidad de envases inválida para ${producto.nombre}`
              );
            }

            if (
              envaseVenta.escenario !== "trajo_envase" &&
              !String(envaseVenta.cliente || "").trim()
            ) {
              return rollback(
                res,
                `Indica el cliente para el envase de ${producto.nombre}`
              );
            }
          }

          db.get(
            `
            SELECT cantidad_actual
FROM inventario
WHERE tienda_id = ?
AND producto_id = ?
`,
            [
              tienda_id,
              Number(producto.es_derivado) === 1
                ? producto.producto_padre_id
                : producto_id,
            ],
            (errorInventario, inventario) => {
              if (errorInventario)
                return rollback(res, "Error al consultar inventario");

              const cantidadInventario =
                Number(producto.es_derivado) === 1
                  ? Number(cantidad) * Number(producto.factor_conversion)
                  : Number(cantidad);

              if (
                !inventario ||
                inventario.cantidad_actual < cantidadInventario
              ) {
                return rollback(
                  res,
                  `Inventario insuficiente para ${producto.nombre}`,
                );
              }

const precioUnitarioNormal = Number(producto.precio_aplicable);

db.get(
  `
  SELECT
    id,
    cantidad_requerida,
    precio_promocion
  FROM promociones
  WHERE producto_id = ?
  AND activa = 1
  LIMIT 1
  `,
  [producto.id],
  (errorPromocion, promocion) => {
    if (errorPromocion) {
      return rollback(res, "Error al consultar promoción");
    }

    let resultadoPrecio;

    const productoPuedeTenerPromo =
      producto.tipo_producto !== "peso_variable" &&
      Number(producto.es_derivado) !== 1;

    if (productoPuedeTenerPromo) {
      resultadoPrecio = calcularPromocionProducto(
        cantidad,
        precioUnitarioNormal,
        promocion
      );
    } else {
      resultadoPrecio = calcularPromocionProducto(
        cantidad,
        precioUnitarioNormal,
        null
      );
    }

    let subtotal = resultadoPrecio.subtotal;

    if (producto.tipo_producto === "peso_variable") {
      subtotal = redondearAMedioPeso(subtotal);
    }

    subtotalVenta += subtotal;

    detalles.push({
      producto_id: producto.id,
      producto_inventario_id:
        Number(producto.es_derivado) === 1
          ? producto.producto_padre_id
          : producto.id,
      cantidad_inventario:
        Number(producto.es_derivado) === 1
          ? Number(cantidad) * Number(producto.factor_conversion)
          : Number(cantidad),
      codigo_barras: producto.codigo_barras,
      nombre_producto: producto.nombre,
      tipo_producto: producto.tipo_producto,
      cantidad,
      unidad: producto.unidad,

      precio_unitario: resultadoPrecio.precioUnitarioFinal,
      subtotal,

      promocion_id: resultadoPrecio.promocionId,
      precio_unitario_original: resultadoPrecio.precioUnitarioOriginal,
      precio_unitario_final: resultadoPrecio.precioUnitarioFinal,
      cantidad_promocion_aplicada: resultadoPrecio.cantidadPromocionAplicada,
      descuento_promocion: resultadoPrecio.descuentoPromocion,
    });

    procesarProducto(index + 1);
  }
);
            },
          );
        },
      );
    };

    const validarInventarioAgrupado = () => {
      const requeridos = new Map();

      detalles.forEach((detalle) => {
        const productoInventarioId = Number(detalle.producto_inventario_id);
        const previo = requeridos.get(productoInventarioId) || {
          cantidad: 0,
          nombre: detalle.nombre_producto,
        };

        previo.cantidad += Number(detalle.cantidad_inventario);
        requeridos.set(productoInventarioId, previo);
      });

      const pendientes = Array.from(requeridos.entries());

      const revisar = (index) => {
        if (index >= pendientes.length) {
          guardarVenta();
          return;
        }

        const [productoInventarioId, requerido] = pendientes[index];

        db.get(
          `
          SELECT cantidad_actual
          FROM inventario
          WHERE tienda_id = ?
          AND producto_id = ?
          `,
          [tienda_id, productoInventarioId],
          (errorInventario, inventario) => {
            if (errorInventario) {
              return rollback(res, "Error al consultar inventario");
            }

            if (
              !inventario ||
              Number(inventario.cantidad_actual) < Number(requerido.cantidad)
            ) {
              return rollback(
                res,
                `Inventario insuficiente para ${requerido.nombre}`
              );
            }

            revisar(index + 1);
          }
        );
      };

      revisar(0);
    };

    const guardarVenta = () => {
      db.run(
        `
        INSERT INTO ventas (
          folio,
          tienda_id,
          usuario_id,
          subtotal,
          total,
          metodo_pago,
          estado
        )
        VALUES (?, ?, ?, ?, ?, ?, 'completada')
        `,
        [
          folio,
          tienda_id,
          usuario_id,
          subtotalVenta,
          subtotalVenta,
          metodo_pago,
        ],
        function (error) {
          if (error) return rollback(res, "Error al guardar venta");

          const ventaId = this.lastID;
          const continuarGuardandoDetalles = () => guardarDetalles(ventaId, 0);

          if (metodo_pago === "fiado") {
            const conceptoFiado = productos
              .map((item) => `${item.cantidad} ${item.nombre || "producto"}`)
              .join(", ");

            return db.run(
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
                cliente_fiado_id,
                usuario_id,
                tienda_id,
                conceptoFiado,
                subtotalVenta,
              ],
              (errorFiado) => {
                if (errorFiado) {
                  return rollback(res, "Error al registrar fiado");
                }

                continuarGuardandoDetalles();
              }
            );
          }

          continuarGuardandoDetalles();
        },
      );
    };

    const guardarDetalles = (ventaId, index) => {
      if (index >= detalles.length) {
        registrarEnvasesVenta(
          {
            tienda_id,
            usuario_id,
            folio,
            envases: envasesVenta,
          },
          (errorEnvases) => {
            if (errorEnvases) {
              return rollback(res, errorEnvases);
            }

            db.run("COMMIT", (error) => {
              if (error) return rollback(res, "Error al confirmar venta");

              return res.status(201).json({
                mensaje: "Venta registrada correctamente",
                venta_id: ventaId,
                folio,
                total: subtotalVenta,
              });
            });
          }
        );

        return;
      }

      const detalle = detalles[index];

      db.run(
        `
       INSERT INTO venta_detalles (
  venta_id,
  producto_id,
  codigo_barras,
  nombre_producto,
  tipo_producto,
  cantidad,
  unidad,
  precio_unitario,
  subtotal,
  promocion_id,
  precio_unitario_original,
  precio_unitario_final,
  cantidad_promocion_aplicada,
  descuento_promocion
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
  ventaId,
  detalle.producto_id,
  detalle.codigo_barras,
  detalle.nombre_producto,
  detalle.tipo_producto,
  detalle.cantidad,
  detalle.unidad,
  detalle.precio_unitario,
  detalle.subtotal,
  detalle.promocion_id,
  detalle.precio_unitario_original,
  detalle.precio_unitario_final,
  detalle.cantidad_promocion_aplicada,
  detalle.descuento_promocion,
],
        (error) => {
          if (error) return rollback(res, "Error al guardar detalle de venta");

          db.run(
            `
            UPDATE inventario
SET cantidad_actual = cantidad_actual - ?,
    ultima_actualizacion = CURRENT_TIMESTAMP
WHERE tienda_id = ?
AND producto_id = ?
AND cantidad_actual >= ?
`,
            [
              detalle.cantidad_inventario,
              tienda_id,
              detalle.producto_inventario_id,
              detalle.cantidad_inventario,
            ],
            function (errorInventario) {
              if (errorInventario)
                return rollback(res, "Error al descontar inventario");

              if (this.changes === 0) {
                return rollback(
                  res,
                  `Inventario insuficiente para ${detalle.nombre_producto}`
                );
              }

              guardarDetalles(ventaId, index + 1);
            },
          );
        },
      );
    };

    procesarProducto(0);
    });
  });
};

const rollback = (res, mensaje) => {
  db.run("ROLLBACK", () => {
    return res.status(400).json({
      error: mensaje,
    });
  });
};

const obtenerVentas = (req, res) => {
  const { tienda_id } = req.query;

  let query = `
    SELECT
      v.id,
      v.folio,
      t.nombre AS tienda,
      u.nombre AS usuario,
      v.subtotal,
      v.total,
      v.metodo_pago,
      v.estado,
      v.fecha_venta
    FROM ventas v
    INNER JOIN tiendas t ON t.id = v.tienda_id
    INNER JOIN usuarios u ON u.id = v.usuario_id
  `;

  const condiciones = [];
  const params = [];

  if (tienda_id) {
    condiciones.push("v.tienda_id = ?");
    params.push(tienda_id);
  }

  if (req.usuario.rol === "empleado") {
    condiciones.push("v.usuario_id = ?");
    params.push(req.usuario.id);
  }

  if (condiciones.length > 0) {
    query += `
      WHERE ${condiciones.join(" AND ")}
    `;
  }

  query += `
    ORDER BY v.fecha_venta DESC
  `;

  db.all(query, params, (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener ventas",
      });
    }

    res.json(rows);
  });
};

const obtenerVentaPorId = (req, res) => {
  const { id } = req.params;

  const queryVenta = `
    SELECT
      v.id,
      v.folio,
      v.tienda_id,
      t.nombre AS tienda,
      v.usuario_id,
      u.nombre AS usuario,
      v.subtotal,
      v.total,
      v.metodo_pago,
      v.estado,
      v.fecha_venta
    FROM ventas v
    INNER JOIN tiendas t ON t.id = v.tienda_id
    INNER JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.id = ?
  `;

  db.get(queryVenta, [id], (error, venta) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener venta",
      });
    }

    if (!venta) {
      return res.status(404).json({
        error: "Venta no encontrada",
      });
    }

    const queryDetalles = `
      SELECT
        id,
        producto_id,
        codigo_barras,
        nombre_producto,
        tipo_producto,
        cantidad,
        unidad,
        precio_unitario,
        subtotal
      FROM venta_detalles
      WHERE venta_id = ?
    `;

    db.all(queryDetalles, [id], (errorDetalles, detalles) => {
      if (errorDetalles) {
        return res.status(500).json({
          error: "Error al obtener detalles de venta",
        });
      }

      res.json({
        ...venta,
        detalles,
      });
    });
  });
};

const obtenerDetalleVenta = (req, res) => {
  const { id } = req.params;

  const queryVenta = `
    SELECT
      v.*,
      t.nombre AS tienda,
      u.nombre AS usuario

    FROM ventas v

    INNER JOIN tiendas t
      ON t.id = v.tienda_id

    INNER JOIN usuarios u
      ON u.id = v.usuario_id

    WHERE v.id = ?
  `;
////////////////////////////////////////////////////////////////////////////////////////////////kldnjkcncsdcnds
const queryDetalles = `
  SELECT
    vd.id,
    vd.venta_id,
    vd.producto_id,
    vd.cantidad,
    vd.unidad,
    vd.precio_unitario,
    vd.subtotal,
    vd.nombre_producto AS producto_nombre,
    vd.tipo_producto,

    vd.promocion_id,
    vd.precio_unitario_original,
    vd.precio_unitario_final,
    vd.cantidad_promocion_aplicada,
    vd.descuento_promocion,

    pr.cantidad_requerida AS promocion_cantidad_requerida,
    pr.precio_promocion AS promocion_precio,

    COALESCE(SUM(dd.cantidad), 0) AS cantidad_devuelta,

    vd.cantidad - COALESCE(SUM(dd.cantidad), 0) AS cantidad_restante_devolucion

  FROM venta_detalles vd

  LEFT JOIN promociones pr
    ON pr.id = vd.promocion_id

  LEFT JOIN devoluciones d
    ON d.venta_id = vd.venta_id

  LEFT JOIN devolucion_detalles dd
    ON dd.devolucion_id = d.id
    AND dd.producto_id = vd.producto_id

  WHERE vd.venta_id = ?

  GROUP BY vd.id
`;

  db.get(queryVenta, [id], (errorVenta, venta) => {
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

    db.all(queryDetalles, [id], (errorDetalles, detalles) => {
      if (errorDetalles) {
        return res.status(500).json({
          error: "Error al obtener detalles",
        });
      }

      res.json({
        venta,
        detalles,
      });
    });
  });
};

module.exports = {
  crearVenta,
  obtenerVentas,
  obtenerVentaPorId,
  obtenerDetalleVenta,
};
