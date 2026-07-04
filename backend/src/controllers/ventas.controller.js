const db = require("../database/connection");
const {
  calcularSubtotalOperativo,
  esProductoAGranel,
} = require("../../../frontend/js/redondeo-operativo");
const { calcularImporteEnvase } = require("../utils/importes-envases");

const calcularPromocionProducto = (cantidad, precioNormal, promociones = []) => {
  const cantidadNumero = Number(cantidad);
  const precioNormalNumero = Number(precioNormal);

  const respuestaNormal = () => {
    const subtotalNormal = cantidadNumero * precioNormalNumero;

    return {
      subtotal: subtotalNormal,
      precioUnitarioFinal: precioNormalNumero,
      precioUnitarioOriginal: precioNormalNumero,
      promocionId: null,
      cantidadPromocionAplicada: 0,
      descuentoPromocion: 0,
    };
  };

  if (
    !Number.isInteger(cantidadNumero) ||
    cantidadNumero <= 0 ||
    !Array.isArray(promociones) ||
    promociones.length === 0
  ) {
    return respuestaNormal();
  }

  const promocionesValidas = promociones
    .map((promo) => ({
      id: promo.id,
      cantidad: Number(promo.cantidad_requerida),
      precioCentavos: Math.round(Number(promo.precio_promocion) * 100),
    }))
    .filter((promo) =>
      Number.isInteger(promo.cantidad) &&
      promo.cantidad >= 2 &&
      promo.precioCentavos > 0
    )
    .sort((a, b) => {
      const precioUnidadA = a.precioCentavos / a.cantidad;
      const precioUnidadB = b.precioCentavos / b.cantidad;

      if (precioUnidadA !== precioUnidadB) {
        return precioUnidadA - precioUnidadB;
      }

      return b.cantidad - a.cantidad;
    });

  if (promocionesValidas.length === 0) {
    return respuestaNormal();
  }

  const precioNormalCentavos = Math.round(precioNormalNumero * 100);
  const dp = Array.from({ length: cantidadNumero + 1 }, () => ({
    total: 0,
    conteoPromos: {},
    cantidadPromo: 0,
  }));

  for (let i = 1; i <= cantidadNumero; i += 1) {
    let mejor = {
      total: dp[i - 1].total + precioNormalCentavos,
      conteoPromos: { ...dp[i - 1].conteoPromos },
      cantidadPromo: dp[i - 1].cantidadPromo,
    };

    promocionesValidas.forEach((promo) => {
      if (i < promo.cantidad) return;

      const anterior = dp[i - promo.cantidad];
      const candidato = {
        total: anterior.total + promo.precioCentavos,
        conteoPromos: {
          ...anterior.conteoPromos,
          [promo.id]: (anterior.conteoPromos[promo.id] || 0) + 1,
        },
        cantidadPromo: anterior.cantidadPromo + promo.cantidad,
      };

      if (candidato.total < mejor.total) {
        mejor = candidato;
      }
    });

    dp[i] = mejor;
  }

  const mejorResultado = dp[cantidadNumero];
  const subtotalFinal = mejorResultado.total / 100;
  const subtotalOriginal = cantidadNumero * precioNormalNumero;
  const descuentoPromocion = subtotalOriginal - subtotalFinal;

  if (descuentoPromocion <= 0 || mejorResultado.cantidadPromo <= 0) {
    return respuestaNormal();
  }

  const precioUnitarioFinal = subtotalFinal / cantidadNumero;
  const promocionPrincipal = promocionesValidas.find(
    (promo) => mejorResultado.conteoPromos[promo.id] > 0
  );

  return {
    subtotal: subtotalFinal,
    precioUnitarioFinal,
    precioUnitarioOriginal: precioNormalNumero,
    promocionId: promocionPrincipal?.id || null,
    cantidadPromocionAplicada: mejorResultado.cantidadPromo,
    descuentoPromocion,
  };
};

const escenariosEnvaseValidos = [
  "trajo_envase",
  "dejo_importe",
  "envase_prestado",
];

const redondearCentavos = (monto) => {
  return Math.round(Number(monto || 0) * 100) / 100;
};

const validarPagoMixto = (pagoMixto, totalProductos) => {
  const efectivo = redondearCentavos(pagoMixto?.efectivo);
  const transferencia = redondearCentavos(pagoMixto?.transferencia);
  const fiado = redondearCentavos(pagoMixto?.fiado);
  const total = redondearCentavos(totalProductos);
  const clienteFiadoId = pagoMixto?.cliente_fiado_id
    ? Number(pagoMixto.cliente_fiado_id)
    : null;

  if (efectivo < 0 || transferencia < 0 || fiado < 0) {
    return {
      error: "Los montos del pago mixto no pueden ser negativos",
    };
  }

  const suma = redondearCentavos(efectivo + transferencia + fiado);

  if (Math.abs(suma - total) > 0.01) {
    return {
      error: "El pago mixto debe sumar exactamente el total de la venta",
    };
  }

  if (fiado > 0 && !clienteFiadoId) {
    return {
      error: "Selecciona cliente fiado para el pago mixto",
    };
  }

  return {
    pago: {
      efectivo,
      transferencia,
      fiado,
      clienteFiadoId,
      observaciones: String(pagoMixto?.observaciones || "").trim() || null,
    },
  };
};

const prepararServiciosVenta = (servicios = []) => {
  if (!Array.isArray(servicios)) {
    return {
      error: "Servicios invalidos en la venta",
      servicios: [],
      total: 0,
    };
  }

  const preparados = [];
  let total = 0;

  for (const item of servicios) {
    const tipo = String(item.tipo || "").trim();
    const montoBase = redondearCentavos(item.monto_base);

    if (!["recarga", "servicio"].includes(tipo)) {
      return {
        error: "Tipo de servicio invalido",
      };
    }

    if (!montoBase || montoBase <= 0) {
      return {
        error: "El monto del servicio debe ser mayor a cero",
      };
    }

    const comision = tipo === "recarga" ? 1 : 0;
    const totalCobrado = redondearCentavos(montoBase + comision);
    const descripcion =
      tipo === "recarga"
        ? `Recarga $${montoBase.toFixed(2)}`
        : `Pago de servicio`;

    preparados.push({
      tipo,
      descripcion,
      monto_base: montoBase,
      comision,
      total_cobrado: totalCobrado,
    });

    total += totalCobrado;
  }

  return {
    servicios: preparados,
    total: redondearCentavos(total),
  };
};

const crearConceptoLineasVenta = (detalles = [], servicios = []) => {
  const conceptosProductos = detalles.map(
    (item) => `${item.cantidad} ${item.nombre_producto || "producto"}`
  );

  const conceptosServicios = servicios.map((item) => item.descripcion);

  return conceptosProductos.concat(conceptosServicios).join(", ");
};

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
              ? calcularImporteEnvase(tipoEnvase, cantidad)
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
                procesarEnvase(index + 1);
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
    pago_mixto,
    servicios,
  } = req.body;

  const envasesVenta = Array.isArray(envases) ? envases : [];
  const resultadoServicios = prepararServiciosVenta(servicios);

  if (resultadoServicios.error) {
    return res.status(400).json({
      error: resultadoServicios.error,
    });
  }

  const serviciosVenta = resultadoServicios.servicios;
  const totalServiciosVenta = resultadoServicios.total;

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
    (productos.length === 0 && serviciosVenta.length === 0)
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
        subtotalVenta = redondearCentavos(subtotalVenta + totalServiciosVenta);
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

db.all(
  `
  SELECT
    id,
    cantidad_requerida,
    precio_promocion
  FROM promociones
  WHERE producto_id = ?
  AND activa = 1
  ORDER BY cantidad_requerida DESC
  `,
  [producto.id],
  (errorPromocion, promocionesProducto) => {
    if (errorPromocion) {
      return rollback(res, "Error al consultar promoción");
    }

    let resultadoPrecio;

    const productoPuedeTenerPromo =
      !esProductoAGranel(producto) &&
      Number(producto.es_derivado) !== 1;

    if (productoPuedeTenerPromo) {
      resultadoPrecio = calcularPromocionProducto(
        cantidad,
        precioUnitarioNormal,
        promocionesProducto
      );
    } else {
      resultadoPrecio = calcularPromocionProducto(
        cantidad,
        precioUnitarioNormal,
        null
      );
    }

    let subtotal = calcularSubtotalOperativo(producto, resultadoPrecio.subtotal);

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

      if (pendientes.length === 0) {
        guardarVenta();
        return;
      }

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
      let pagoMixtoValidado = null;

      if (metodo_pago === "mixto") {
        const resultadoPagoMixto = validarPagoMixto(pago_mixto, subtotalVenta);

        if (resultadoPagoMixto.error) {
          return rollback(res, resultadoPagoMixto.error);
        }

        pagoMixtoValidado = resultadoPagoMixto.pago;
      }

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

          if (metodo_pago === "mixto") {
            return registrarPagoMixtoVenta(
              {
                ventaId,
                tienda_id,
                usuario_id,
                folio,
                detalles,
                servicios: serviciosVenta,
                subtotalVenta,
                pago: pagoMixtoValidado,
              },
              (errorPagoMixto) => {
                if (errorPagoMixto) {
                  return rollback(res, errorPagoMixto);
                }

                continuarGuardandoDetalles();
              }
            );
          }

          if (metodo_pago === "fiado") {
            const conceptoFiado = crearConceptoLineasVenta(
              detalles,
              serviciosVenta
            );

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
        guardarServiciosVenta(ventaId, 0, (errorServicios) => {
          if (errorServicios) {
            return rollback(res, errorServicios);
          }

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
        });

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

    const guardarServiciosVenta = (ventaId, index, callback) => {
      if (index >= serviciosVenta.length) {
        callback();
        return;
      }

      const servicio = serviciosVenta[index];

      db.run(
        `
        INSERT INTO venta_servicios (
          venta_id,
          tipo,
          descripcion,
          monto_base,
          comision,
          total_cobrado
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          ventaId,
          servicio.tipo,
          servicio.descripcion,
          servicio.monto_base,
          servicio.comision,
          servicio.total_cobrado,
        ],
        (errorServicio) => {
          if (errorServicio) {
            callback("Error al guardar servicio de venta");
            return;
          }

          guardarServiciosVenta(ventaId, index + 1, callback);
        }
      );
    };

    procesarProducto(0);
    });
  });
};

const registrarPagoMixtoVenta = (
  {
    ventaId,
    tienda_id,
    usuario_id,
    folio,
    detalles,
    servicios,
    subtotalVenta,
    pago,
  },
  callback
) => {
  const pagos = [
    { metodo: "efectivo", monto: pago.efectivo },
    { metodo: "transferencia", monto: pago.transferencia },
    { metodo: "fiado", monto: pago.fiado },
  ].filter((item) => item.monto > 0);

  const conceptoFiado = crearConceptoLineasVenta(detalles, servicios);

  const guardarPago = (index) => {
    if (index >= pagos.length) {
      callback();
      return;
    }

    const item = pagos[index];
    const clienteFiadoId = item.metodo === "fiado" ? pago.clienteFiadoId : null;

    db.run(
      `
      INSERT INTO venta_pagos (
        venta_id,
        metodo_pago,
        monto,
        cliente_fiado_id,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        ventaId,
        item.metodo,
        item.monto,
        clienteFiadoId,
        pago.observaciones,
      ],
      (errorPago) => {
        if (errorPago) {
          callback("Error al registrar desglose de pago mixto");
          return;
        }

        if (item.metodo === "fiado") {
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
              pago.clienteFiadoId,
              usuario_id,
              tienda_id,
              `Venta mixta ${folio} - ${conceptoFiado}`,
              item.monto,
            ],
            (errorFiado) => {
              if (errorFiado) {
                callback("Error al registrar fiado de pago mixto");
                return;
              }

              guardarPago(index + 1);
            }
          );

          return;
        }

        if (item.metodo === "efectivo") {
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
              item.monto,
              "Venta mixta efectivo",
              `Venta ${folio}`,
            ],
            (errorCaja) => {
              if (errorCaja) {
                callback("Error al registrar efectivo de pago mixto");
                return;
              }

              guardarPago(index + 1);
            }
          );

          return;
        }

        guardarPago(index + 1);
      }
    );
  };

  if (redondearCentavos(subtotalVenta) <= 0) {
    callback("Total invalido para pago mixto");
    return;
  }

  guardarPago(0);
};

const rollback = (res, mensaje) => {
  db.run("ROLLBACK", () => {
    return res.status(400).json({
      error: mensaje,
    });
  });
};

const obtenerVentas = (req, res) => {
  const {
    tienda_id,
    busqueda,
    periodo,
    fecha_inicio,
    fecha_fin,
  } = req.query;

  const limite = Math.min(Math.max(Number(req.query.limite) || 60, 1), 60);
  const pagina = Math.max(Number(req.query.pagina) || 1, 1);
  const offset = (pagina - 1) * limite;

  const fechaLocalVenta = "DATE(datetime(v.fecha_venta, 'localtime'))";

  const selectBase = `
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

  const hoy = new Date();
  const hoyLocal = formatearFechaInputLocal(hoy);

  if (periodo === "hoy") {
    condiciones.push(`${fechaLocalVenta} = ?`);
    params.push(hoyLocal);
  } else if (periodo === "ayer") {
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    condiciones.push(`${fechaLocalVenta} = ?`);
    params.push(formatearFechaInputLocal(ayer));
  } else {
    if (fecha_inicio) {
      condiciones.push(`${fechaLocalVenta} >= ?`);
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      condiciones.push(`${fechaLocalVenta} <= ?`);
      params.push(fecha_fin);
    }
  }

  if (busqueda) {
    const textoBusqueda = `%${String(busqueda).trim()}%`;
    condiciones.push(`
      (
        v.folio LIKE ?
        OR u.nombre LIKE ?
        OR v.metodo_pago LIKE ?
        OR v.estado LIKE ?
      )
    `);
    params.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);
  }

  const whereSql =
    condiciones.length > 0
      ? `WHERE ${condiciones.join(" AND ")}`
      : "";

  const query = `
    ${selectBase}
    ${whereSql}
    ORDER BY v.fecha_venta DESC, v.id DESC
    LIMIT ? OFFSET ?
  `;

  const queryTotal = `
    SELECT COUNT(*) AS total
    FROM ventas v
    INNER JOIN tiendas t ON t.id = v.tienda_id
    INNER JOIN usuarios u ON u.id = v.usuario_id
    ${whereSql}
  `;

  db.get(queryTotal, params, (errorTotal, totalRow) => {
    if (errorTotal) {
      return res.status(500).json({
        error: "Error al contar ventas",
      });
    }

    db.all(query, [...params, limite, offset], (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener ventas",
        });
      }

      const total = Number(totalRow?.total || 0);

      res.json({
        ventas: rows,
        paginacion: {
          pagina,
          limite,
          total,
          total_paginas: Math.max(Math.ceil(total / limite), 1),
        },
      });
    });
  });
};

function formatearFechaInputLocal(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

      obtenerServiciosVenta(id, (errorServicios, servicios) => {
        if (errorServicios) {
          return res.status(500).json({
            error: "Error al obtener servicios de venta",
          });
        }

        res.json({
          ...venta,
          detalles: detalles.concat(servicios),
        });
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
    NULL AS servicio_id,
    'producto' AS detalle_tipo,
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

      obtenerServiciosVenta(id, (errorServicios, servicios) => {
        if (errorServicios) {
          return res.status(500).json({
            error: "Error al obtener servicios",
          });
        }

        res.json({
          venta,
          detalles: detalles.concat(servicios),
        });
      });
    });
  });
};

const obtenerServiciosVenta = (ventaId, callback) => {
  db.all(
    `
    SELECT
      vs.id,
      vs.venta_id,
      NULL AS producto_id,
      vs.id AS servicio_id,
      'servicio' AS detalle_tipo,
      1 AS cantidad,
      'servicio' AS unidad,
      vs.total_cobrado AS precio_unitario,
      vs.total_cobrado AS subtotal,
      vs.descripcion AS nombre_producto,
      vs.descripcion AS producto_nombre,
      vs.tipo AS tipo_producto,
      NULL AS promocion_id,
      vs.total_cobrado AS precio_unitario_original,
      vs.total_cobrado AS precio_unitario_final,
      0 AS cantidad_promocion_aplicada,
      0 AS descuento_promocion,
      0 AS promocion_cantidad_requerida,
      0 AS promocion_precio,
      COALESCE(SUM(dd.cantidad), 0) AS cantidad_devuelta,
      1 - COALESCE(SUM(dd.cantidad), 0) AS cantidad_restante_devolucion
    FROM venta_servicios vs
    LEFT JOIN devoluciones d
      ON d.venta_id = vs.venta_id
    LEFT JOIN devolucion_detalles dd
      ON dd.devolucion_id = d.id
      AND dd.servicio_id = vs.id
    WHERE vs.venta_id = ?
    GROUP BY vs.id
    ORDER BY vs.id ASC
    `,
    [ventaId],
    callback
  );
};

module.exports = {
  crearVenta,
  obtenerVentas,
  obtenerVentaPorId,
  obtenerDetalleVenta,
};
