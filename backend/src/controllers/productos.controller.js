const db = require("../database/connection");

const obtenerProductos = (req, res) => {
  const query = `
    SELECT *
    FROM productos
    WHERE activo = 1
    ORDER BY nombre ASC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      console.error(error.message);

      return res.status(500).json({
        error: "Error al obtener productos",
      });
    }

    res.json(rows);
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

    res.json(row);
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

    res.json(rows);
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
    factor_conversion
  } = req.body;

  if (!tipo_producto || !nombre || !unidad || precio_global == null) {
    return res.status(400).json({
      error: "Tipo, nombre, unidad y precio son obligatorios",
    });
  }

  if (!["codigo_barras", "peso_variable", "manual"].includes(tipo_producto)) {
    return res.status(400).json({
      error: "Tipo de producto inválido",
    });
  }

  if (tipo_producto === "codigo_barras" && !codigo_barras) {
    return res.status(400).json({
      error: "El código de barras es obligatorio para este tipo de producto",
    });
  }

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
      factor_conversion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      tipo_producto,
      codigo_barras || null,
      nombre,
      categoria || null,
      marca || null,
      presentacion || null,
      unidad,
      precio_global,
      costo_compra || 0,
      requiere_caducidad ? 1 : 0,
      es_derivado || 0,
      producto_padre_id || null,
      factor_conversion || 1
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
};
const obtenerProductoPorId = (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT *
    FROM productos
    WHERE id = ?
    AND activo = 1
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

    res.json(row);
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
    factor_conversion
  } = req.body;

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
      requiere_caducidad = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [
      tipo_producto,
      codigo_barras || null,
      nombre,
      categoria,
      marca,
      presentacion,
      unidad,
      precio_global,
      costo_compra,
      requiere_caducidad ? 1 : 0,
      es_derivado || 0,
      producto_padre_id || null,
      factor_conversion || 1,
      id,
    ],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al actualizar producto",
        });
      }

      res.json({
        mensaje: "Producto actualizado correctamente",
      });
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

    res.json(rows);
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

