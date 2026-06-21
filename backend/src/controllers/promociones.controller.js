const db = require("../database/connection");

const validarAdmin = (req, res) => {
  if (!req.usuario || req.usuario.rol !== "administrador") {
    res.status(403).json({
      error: "Solo administradores pueden gestionar promociones",
    });

    return false;
  }

  return true;
};

const obtenerProductosElegibles = (req, res) => {
  if (!validarAdmin(req, res)) return;

  const query = `
    SELECT
      id,
      nombre,
      codigo_barras,
      NULLIF(categoria, '[object Object]') AS categoria,
      NULLIF(marca, '[object Object]') AS marca,
      NULLIF(presentacion, '[object Object]') AS presentacion,
      tipo_producto,
      es_derivado,
      unidad,
      precio_global,
      activo
    FROM productos
    WHERE activo = 1
    AND tipo_producto != 'peso_variable'
    AND es_derivado = 0
    ORDER BY nombre ASC
  `;

  db.all(query, [], (error, productos) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener productos elegibles",
        detalle: error.message,
      });
    }

    return res.json(productos);
  });
};

const obtenerPromociones = (req, res) => {
  if (!validarAdmin(req, res)) return;

  const query = `
    SELECT
      pr.id,
      pr.producto_id,
      p.nombre AS producto_nombre,
      p.tipo_producto,
      p.unidad,
      p.precio_global,
      pr.cantidad_requerida,
      pr.precio_promocion,
      pr.activa,
      pr.fecha_creacion,
      pr.fecha_actualizacion
    FROM promociones pr
    INNER JOIN productos p
      ON p.id = pr.producto_id
    ORDER BY p.nombre ASC, pr.activa DESC, pr.cantidad_requerida ASC, pr.fecha_creacion DESC
  `;

  db.all(query, [], (error, promociones) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener promociones",
        detalle: error.message,
      });
    }

    return res.json(promociones);
  });
};

const crearPromocion = (req, res) => {
  if (!validarAdmin(req, res)) return;

  const {
    producto_id,
    cantidad_requerida,
    precio_promocion,
  } = req.body;

  if (
    !producto_id ||
    !cantidad_requerida ||
    !precio_promocion
  ) {
    return res.status(400).json({
      error: "Producto, cantidad y precio de promoción son obligatorios",
    });
  }

  const cantidadRequerida = Number(cantidad_requerida);
  const precioPromocion = Number(precio_promocion);

  if (!Number.isInteger(cantidadRequerida) || cantidadRequerida < 2) {
    return res.status(400).json({
      error: "La cantidad requerida debe ser un número entero mayor o igual a 2",
    });
  }

  if (precioPromocion <= 0) {
    return res.status(400).json({
      error: "El precio de promoción debe ser mayor a 0",
    });
  }

  db.get(
    `
    SELECT
      id,
      nombre,
      tipo_producto,
      es_derivado,
      precio_global,
      activo
    FROM productos
    WHERE id = ?
    AND activo = 1
    `,
    [producto_id],
    (errorProducto, producto) => {
      if (errorProducto) {
        return res.status(500).json({
          error: "Error al validar producto",
          detalle: errorProducto.message,
        });
      }

      if (!producto) {
        return res.status(404).json({
          error: "Producto no encontrado o inactivo",
        });
      }

      if (producto.tipo_producto === "peso_variable") {
        return res.status(400).json({
          error: "No se pueden crear promociones para productos a granel",
        });
      }

      if (Number(producto.es_derivado) === 1) {
        return res.status(400).json({
          error: "No se pueden crear promociones para productos sueltos o derivados",
        });
      }

      db.get(
        `
        SELECT id
        FROM promociones
        WHERE producto_id = ?
        AND cantidad_requerida = ?
        AND activa = 1
        LIMIT 1
        `,
        [producto_id, cantidadRequerida],
        (errorPromoActiva, promoActiva) => {
          if (errorPromoActiva) {
            return res.status(500).json({
              error: "Error al validar promoción activa",
              detalle: errorPromoActiva.message,
            });
          }

          if (promoActiva) {
            return res.status(400).json({
              error: "Este producto ya tiene una promoción activa con esa cantidad",
            });
          }

          const queryInsert = `
            INSERT INTO promociones (
              producto_id,
              cantidad_requerida,
              precio_promocion,
              activa
            )
            VALUES (?, ?, ?, 1)
          `;

          db.run(
            queryInsert,
            [
              producto_id,
              cantidadRequerida,
              precioPromocion,
            ],
            function (errorInsert) {
              if (errorInsert) {
                return res.status(500).json({
                  error: "Error al crear promoción",
                  detalle: errorInsert.message,
                });
              }

              return res.status(201).json({
                mensaje: "Promoción creada correctamente",
                promocion_id: this.lastID,
              });
            }
          );
        }
      );
    }
  );
};

const desactivarPromocion = (req, res) => {
  if (!validarAdmin(req, res)) return;

  const { id } = req.params;

  db.run(
    `
    UPDATE promociones
    SET activa = 0,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [id],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: "Error al desactivar promoción",
          detalle: error.message,
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Promoción no encontrada",
        });
      }

      return res.json({
        mensaje: "Promoción desactivada correctamente",
      });
    }
  );
};

const obtenerPromocionesActivasVenta = (req, res) => {
  const query = `
    SELECT
      pr.id,
      pr.producto_id,
      pr.cantidad_requerida,
      pr.precio_promocion,

      p.nombre AS producto_nombre,
      p.precio_global,
      p.unidad,
      p.tipo_producto,
      p.es_derivado

    FROM promociones pr

    INNER JOIN productos p
      ON p.id = pr.producto_id

    WHERE pr.activa = 1
    AND p.activo = 1
    AND p.tipo_producto != 'peso_variable'
    AND p.es_derivado = 0
    ORDER BY pr.producto_id ASC, pr.cantidad_requerida DESC
  `;

  db.all(query, [], (error, promociones) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener promociones activas",
        detalle: error.message,
      });
    }

    return res.json(promociones);
  });
};

module.exports = {
  obtenerProductosElegibles,
  obtenerPromociones,
  crearPromocion,
  desactivarPromocion,
  obtenerPromocionesActivasVenta,

};
