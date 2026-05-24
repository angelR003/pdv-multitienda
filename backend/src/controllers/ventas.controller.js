const db = require("../database/connection");
const redondearAMedioPeso = (monto) => {
  return Math.round(monto * 2) / 2;
};

const crearVenta = (req, res) => {
  const { tienda_id, usuario_id, metodo_pago, productos, cliente_fiado_id } =
    req.body;

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
    db.run("BEGIN TRANSACTION");

    let subtotalVenta = 0;
    const detalles = [];

    const procesarProducto = (index) => {
      if (index >= productos.length) {
        guardarVenta();
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
          if (error) return rollback(res, "Error al buscar producto");
          if (!producto) return rollback(res, "Producto no encontrado");

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

              const precioUnitario = producto.precio_aplicable;
              let subtotal = cantidad * precioUnitario;

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
                precio_unitario: precioUnitario,
                subtotal,
              });

              procesarProducto(index + 1);
            },
          );
        },
      );
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
          if (metodo_pago === "fiado") {
            const conceptoFiado = productos
              .map((item) => `${item.cantidad} ${item.nombre || "producto"}`)
              .join(", ");

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
                cliente_fiado_id,
                usuario_id,
                tienda_id,
                conceptoFiado,
                subtotalVenta,
              ],
            );
          }
          guardarDetalles(ventaId, 0);
        },
      );
    };

    const guardarDetalles = (ventaId, index) => {
      if (index >= detalles.length) {
        db.run("COMMIT", (error) => {
          if (error) return rollback(res, "Error al confirmar venta");

          return res.status(201).json({
            mensaje: "Venta registrada correctamente",
            venta_id: ventaId,
            folio,
            total: subtotalVenta,
          });
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
          subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
`,
            [
              detalle.cantidad_inventario,
              tienda_id,
              detalle.producto_inventario_id,
            ],
            (errorInventario) => {
              if (errorInventario)
                return rollback(res, "Error al descontar inventario");

              guardarDetalles(ventaId, index + 1);
            },
          );
        },
      );
    };

    procesarProducto(0);
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

  const queryDetalles = `
    SELECT
      vd.*,
      p.nombre AS producto,
      p.unidad

    FROM venta_detalles vd

    INNER JOIN productos p
      ON p.id = vd.producto_id

    WHERE vd.venta_id = ?
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
