const db = require("../database/connection");

const normalizarCampoTexto = (valor) => {
  if (valor == null) return null;

  if (typeof valor === "object") {
    return normalizarCampoTexto(
      valor.nombre ??
      valor.name ??
      valor.label ??
      valor.descripcion ??
      valor.value ??
      null
    );
  }

  const texto = String(valor).trim();

  if (!texto || texto.toLowerCase() === "[object object]") {
    return null;
  }

  return texto;
};

const normalizarProductoSalida = (producto) => ({
  ...producto,
  nombre: normalizarCampoTexto(producto.nombre) || "Producto sin nombre",
  codigo_barras: normalizarCampoTexto(producto.codigo_barras),
  categoria: normalizarCampoTexto(producto.categoria),
  marca: normalizarCampoTexto(producto.marca),
  presentacion: normalizarCampoTexto(producto.presentacion),
  unidad: normalizarCampoTexto(producto.unidad) || "pieza",
});

const validarConfiguracionDerivada = (
  { productoId = null, esDerivado, productoPadreId, factorConversion },
  callback
) => {
  if (!esDerivado) return callback(null);

  const padreId = Number(productoPadreId);
  const factor = Number(factorConversion);

  if (!Number.isInteger(padreId) || padreId <= 0) {
    return callback(new Error("Selecciona un producto padre valido"));
  }

  if (!Number.isFinite(factor) || factor <= 0) {
    return callback(new Error("El factor de conversion debe ser mayor a cero"));
  }

  if (productoId && Number(productoId) === padreId) {
    return callback(new Error("Un producto no puede ser su propio padre"));
  }

  const validarPadre = () => {
    db.get(
      `
        SELECT id, nombre, es_derivado
        FROM productos
        WHERE id = ? AND activo = 1
      `,
      [padreId],
      (errorPadre, padre) => {
        if (errorPadre) return callback(errorPadre);

        if (!padre) {
          return callback(new Error("El producto padre no existe o esta inactivo"));
        }

        if (Number(padre.es_derivado || 0) === 1) {
          return callback(
            new Error("Un producto derivado no puede depender de otro derivado")
          );
        }

        callback(null);
      }
    );
  };

  if (!productoId) return validarPadre();

  db.get(
    `
      SELECT COUNT(*) AS total
      FROM productos
      WHERE producto_padre_id = ?
        AND es_derivado = 1
        AND id <> ?
    `,
    [productoId, productoId],
    (errorHijos, rowHijos) => {
      if (errorHijos) return callback(errorHijos);

      if (Number(rowHijos?.total || 0) > 0) {
        return callback(
          new Error("Un producto padre con derivados no puede convertirse en derivado")
        );
      }

      validarPadre();
    }
  );
};

const productoTieneHistoriaInventario = (productoId, callback) => {
  db.get(
    `
      SELECT CASE WHEN
        EXISTS(SELECT 1 FROM venta_detalles WHERE producto_id = ?)
        OR EXISTS(SELECT 1 FROM entrada_detalles WHERE producto_id = ?)
        OR EXISTS(SELECT 1 FROM ajustes_inventario WHERE producto_id = ?)
        OR EXISTS(SELECT 1 FROM devolucion_detalles WHERE producto_id = ?)
        OR EXISTS(SELECT 1 FROM traspaso_detalles WHERE producto_id = ?)
        OR EXISTS(
          SELECT 1
          FROM inventario
          WHERE producto_id = ? AND ABS(cantidad_actual) > 0.000000001
        )
      THEN 1 ELSE 0 END AS tiene_historia
    `,
    [productoId, productoId, productoId, productoId, productoId, productoId],
    (error, row) => {
      if (error) return callback(error);
      callback(null, Number(row?.tiene_historia || 0) === 1);
    }
  );
};

// Inventario aplica impactos físicos con precisión de nueve decimales. Dos
// factores con la misma representación física no constituyen un cambio real.
const normalizarFactorInventario = (valor) => {
  const factor = Number(valor);
  return Number.isFinite(factor) ? Number(factor.toFixed(9)) : factor;
};

const obtenerProductos = (req, res) => {
  const query = `
    SELECT
      p.*,
      padre.nombre AS producto_padre_nombre,
      padre.unidad AS producto_padre_unidad,
      d.factor_conversion_derivado,
      d.producto_derivado_nombre,
      d.unidad_derivada
    FROM productos p
    LEFT JOIN productos padre ON padre.id = p.producto_padre_id
    LEFT JOIN (
      SELECT
        producto_padre_id,
        MIN(factor_conversion) AS factor_conversion_derivado,
        MAX(nombre) AS producto_derivado_nombre,
        MAX(unidad) AS unidad_derivada
      FROM productos
      WHERE activo = 1
      AND es_derivado = 1
      GROUP BY producto_padre_id
    ) d ON d.producto_padre_id = p.id
    WHERE p.activo = 1
    ORDER BY p.nombre ASC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      console.error(error.message);

      return res.status(500).json({
        error: "Error al obtener productos",
      });
    }

    res.json(rows.map(normalizarProductoSalida));
  });
};
const obtenerProductoPorCodigo = (req, res) => {
  const { codigo } = req.params;
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT 
      p.*,
      COALESCE(pt.precio_especial, p.precio_global) AS precio_aplicable
    FROM productos p
    LEFT JOIN precios_tienda pt
      ON pt.producto_id = p.id
      AND pt.tienda_id = ?
      AND pt.activo = 1
    WHERE p.codigo_barras = ?
    AND p.activo = 1
    LIMIT 1
  `;

  db.get(query, [tienda_id, codigo], (error, row) => {
    if (error) {
      return res.status(500).json({
        error: "Error al buscar producto",
      });
    }

    if (!row) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    res.json(normalizarProductoSalida(row));
  });
};

const obtenerProductosVentaManual = (req, res) => {
  const query = `
    SELECT *
    FROM productos
    WHERE activo = 1
    AND tipo_producto IN ('peso_variable', 'manual')
    ORDER BY nombre ASC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener productos manuales",
      });
    }

    res.json(rows.map(normalizarProductoSalida));
  });
};

const crearProducto = (req, res) => {
  const {
    tipo_producto,
    codigo_barras,
    nombre,
    categoria,
    marca,
    presentacion,
    unidad,
    precio_global,
    costo_compra,
    requiere_caducidad,
    es_derivado,
    producto_padre_id,
    factor_conversion,
    es_retornable,
    tipo_envase_id
  } = req.body;

  const tipoProductoTexto = normalizarCampoTexto(tipo_producto);
  const codigoBarrasTexto = normalizarCampoTexto(codigo_barras);
  const nombreTexto = normalizarCampoTexto(nombre);
  const categoriaTexto = normalizarCampoTexto(categoria);
  const marcaTexto = normalizarCampoTexto(marca);
  const presentacionTexto = normalizarCampoTexto(presentacion);
  const unidadTexto = normalizarCampoTexto(unidad);

  if (!tipoProductoTexto || !nombreTexto || !unidadTexto || precio_global == null) {
    return res.status(400).json({
      error: "Tipo, nombre, unidad y precio son obligatorios",
    });
  }

  if (!["codigo_barras", "peso_variable", "manual"].includes(tipoProductoTexto)) {
    return res.status(400).json({
      error: "Tipo de producto inválido",
    });
  }

  if (tipoProductoTexto === "codigo_barras" && !codigoBarrasTexto) {
    return res.status(400).json({
      error: "El código de barras es obligatorio para este tipo de producto",
    });
  }

    if (es_retornable && !tipo_envase_id) {
    return res.status(400).json({
      error: "Selecciona el tipo de envase para el producto retornable",
    });
  }

  const esDerivadoNumero = Number(es_derivado || 0) === 1;

  const query = `
    INSERT INTO productos (
      tipo_producto,
      codigo_barras,
      nombre,
      categoria,
      marca,
      presentacion,
      unidad,
      precio_global,
      costo_compra,
      requiere_caducidad,
      es_derivado,
      producto_padre_id,
      factor_conversion,
      es_retornable,
      tipo_envase_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  validarConfiguracionDerivada(
    {
      esDerivado: esDerivadoNumero,
      productoPadreId: producto_padre_id,
      factorConversion: factor_conversion,
    },
    (errorDerivado) => {
      if (errorDerivado) {
        return res.status(400).json({ error: errorDerivado.message });
      }

      db.run(
    query,
    [
      tipoProductoTexto,
      codigoBarrasTexto,
      nombreTexto,
      categoriaTexto,
      marcaTexto,
      presentacionTexto,
      unidadTexto,
      precio_global,
      costo_compra || 0,
      requiere_caducidad ? 1 : 0,
      esDerivadoNumero ? 1 : 0,
      esDerivadoNumero ? Number(producto_padre_id) : null,
      esDerivadoNumero ? Number(factor_conversion) : 1,
      es_retornable ? 1 : 0,
      es_retornable ? Number(tipo_envase_id) : null
    ],
    function (error) {
      if (error) {
        if (error.message.includes("UNIQUE")) {
          return res.status(400).json({
            error: "Ya existe un producto con ese código de barras",
          });
        }

        return res.status(500).json({
          error: "Error al crear producto",
        });
      }

      res.status(201).json({
        mensaje: "Producto creado correctamente",
        producto_id: this.lastID,
      });
    }
      );
    }
  );
};
const obtenerProductoPorId = (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      p.*,
      padre.nombre AS producto_padre_nombre,
      CASE WHEN
        EXISTS(SELECT 1 FROM venta_detalles WHERE producto_id = p.id)
        OR EXISTS(SELECT 1 FROM entrada_detalles WHERE producto_id = p.id)
        OR EXISTS(SELECT 1 FROM ajustes_inventario WHERE producto_id = p.id)
        OR EXISTS(SELECT 1 FROM devolucion_detalles WHERE producto_id = p.id)
        OR EXISTS(SELECT 1 FROM traspaso_detalles WHERE producto_id = p.id)
        OR EXISTS(
          SELECT 1 FROM inventario
          WHERE producto_id = p.id AND ABS(cantidad_actual) > 0.000000001
        )
      THEN 1 ELSE 0 END AS tiene_historia_inventario
    FROM productos p
    LEFT JOIN productos padre ON padre.id = p.producto_padre_id
    WHERE p.id = ?
    AND p.activo = 1
  `;

  db.get(query, [id], (error, row) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener producto",
      });
    }

    if (!row) {
      return res.status(404).json({
        error: "Producto no encontrado",
      });
    }

    res.json(normalizarProductoSalida(row));
  });
};

const actualizarProducto = (req, res) => {
  const { id } = req.params;

  const {
    tipo_producto,
    codigo_barras,
    nombre,
    categoria,
    marca,
    presentacion,
    unidad,
    precio_global,
    costo_compra,
    requiere_caducidad,
    es_derivado,
    producto_padre_id,
    factor_conversion,
    actualizar_relacion_derivada,
    es_retornable,
    tipo_envase_id
  } = req.body;

  const tipoProductoTexto = normalizarCampoTexto(tipo_producto);
  const codigoBarrasTexto = normalizarCampoTexto(codigo_barras);
  const nombreTexto = normalizarCampoTexto(nombre);
  const categoriaTexto = normalizarCampoTexto(categoria);
  const marcaTexto = normalizarCampoTexto(marca);
  const presentacionTexto = normalizarCampoTexto(presentacion);
  const unidadTexto = normalizarCampoTexto(unidad);

  if (!tipoProductoTexto || !nombreTexto || !unidadTexto || precio_global == null) {
    return res.status(400).json({
      error: "Tipo, nombre, unidad y precio son obligatorios",
    });
  }

    if (es_retornable && !tipo_envase_id) {
    return res.status(400).json({
      error: "Selecciona el tipo de envase para el producto retornable",
    });
  }

  const productoId = Number(id);
  const solicitaCambioRelacion = actualizar_relacion_derivada === true;

  const query = `
    UPDATE productos
    SET
      tipo_producto = ?,
      codigo_barras = ?,
      nombre = ?,
      categoria = ?,
      marca = ?,
      presentacion = ?,
      unidad = ?,
      precio_global = ?,
      costo_compra = ?,
      requiere_caducidad = ?,
      es_derivado = ?,
      producto_padre_id = ?,
      factor_conversion = ?,
      es_retornable = ?,
      tipo_envase_id = ?
    WHERE id = ?
  `;

  db.get(
    `
      SELECT es_derivado, producto_padre_id, factor_conversion
      FROM productos
      WHERE id = ?
    `,
    [productoId],
    (errorActual, productoActual) => {
      if (errorActual) {
        return res.status(500).json({ error: "Error al consultar producto" });
      }

      if (!productoActual) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }


      const esDerivadoActual = Number(productoActual.es_derivado || 0) === 1;
      const esDerivadoSolicitado = Number(es_derivado || 0) === 1;
      const esDerivadoFinal = solicitaCambioRelacion
        ? esDerivadoSolicitado
        : esDerivadoActual;
      const padreSolicitado = esDerivadoSolicitado
        ? Number(producto_padre_id)
        : null;
      const factorSolicitado = esDerivadoSolicitado
        ? Number(factor_conversion)
        : 1;
      const padreActual = esDerivadoActual
        ? Number(productoActual.producto_padre_id)
        : null;
      const factorActual = esDerivadoActual
        ? Number(productoActual.factor_conversion)
        : 1;
      const relacionCambio = solicitaCambioRelacion && (
        esDerivadoActual !== esDerivadoSolicitado ||
        Number(padreActual || 0) !== Number(padreSolicitado || 0) ||
        normalizarFactorInventario(factorActual) !==
          normalizarFactorInventario(factorSolicitado)
      );
      const padreFinal = relacionCambio ? padreSolicitado : padreActual;
      const factorFinal = relacionCambio ? factorSolicitado : factorActual;

      const ejecutarActualizacion = () => {
        db.run(
          query,
          [
            tipoProductoTexto,
            codigoBarrasTexto,
            nombreTexto,
            categoriaTexto,
            marcaTexto,
            presentacionTexto,
            unidadTexto,
            precio_global,
            costo_compra,
            requiere_caducidad ? 1 : 0,
            esDerivadoFinal ? 1 : 0,
            esDerivadoFinal ? padreFinal : null,
            esDerivadoFinal ? factorFinal : 1,
            es_retornable ? 1 : 0,
            es_retornable ? Number(tipo_envase_id) : null,
            productoId,
          ],
          function (error) {
            if (error) {
              return res.status(500).json({
                error: "Error al actualizar producto",
                detalle: error.message,
              });
            }

            res.json({ mensaje: "Producto actualizado correctamente" });
          }
        );
      };

      if (!relacionCambio) return ejecutarActualizacion();

      validarConfiguracionDerivada(
        {
          productoId,
          esDerivado: esDerivadoSolicitado,
          productoPadreId: padreSolicitado,
          factorConversion: factorSolicitado,
        },
        (errorDerivado) => {
          if (errorDerivado) {
            return res.status(400).json({ error: errorDerivado.message });
          }

          productoTieneHistoriaInventario(
            productoId,
            (errorHistoria, tieneHistoria) => {
              if (errorHistoria) {
                return res.status(500).json({
                  error: "Error al validar historial del producto",
                });
              }

              if (tieneHistoria) {
                return res.status(409).json({
                  error:
                    "No se puede cambiar padre o factor: el producto ya tiene historial de inventario. Desactivalo y crea uno nuevo.",
                });
              }

              ejecutarActualizacion();
            }
          );
        }
      );
    }
  );
};
const desactivarProducto = (req, res) => {
  const { id } = req.params;

  const query = `
    UPDATE productos
    SET activo = 0
    WHERE id = ?
  `;

  db.run(query, [id], function (error) {
    if (error) {
      return res.status(500).json({
        error: "Error al desactivar producto",
      });
    }

    res.json({
      mensaje: "Producto desactivado correctamente",
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
    vd.id,
    vd.venta_id,
    vd.producto_id,
    vd.nombre_producto AS producto,
    vd.tipo_producto,
    vd.cantidad,
    vd.unidad,
    vd.precio_unitario,
    vd.subtotal,

    COALESCE(SUM(dd.cantidad), 0) AS cantidad_devuelta,

    vd.cantidad - COALESCE(SUM(dd.cantidad), 0) AS cantidad_restante_devolucion

  FROM venta_detalles vd

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
const obtenerTodosProductosAdmin = (req, res) => {
  const query = `
    SELECT *
    FROM productos
    ORDER BY id DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener productos",
      });
    }

    res.json(rows.map(normalizarProductoSalida));
  });
};

const activarProducto = (req, res) => {
  const { id } = req.params;

  const query = `
    UPDATE productos
    SET activo = 1
    WHERE id = ?
  `;

  db.run(query, [id], function (error) {
    if (error) {
      return res.status(500).json({
        error: "Error al activar producto",
      });
    }

    res.json({
      mensaje: "Producto activado correctamente",
    });
  });
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorCodigo,
  obtenerProductosVentaManual,
  crearProducto,
  obtenerProductoPorId,
  actualizarProducto,
  desactivarProducto,
  obtenerDetalleVenta,
  obtenerTodosProductosAdmin,
  activarProducto,
};

