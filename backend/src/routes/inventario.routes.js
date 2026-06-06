const express = require("express");
const db = require("../database/connection");

const router = express.Router();

const {
  permitirRoles,
} = require("../middlewares/roles.middleware");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

router.get("/tienda/:tiendaId", (req, res) => {
  const { tiendaId } = req.params;

  const query = `
    SELECT
      i.id,
      i.tienda_id,
      t.nombre AS tienda,
      p.id AS producto_id,
      p.nombre AS producto,
      p.codigo_barras,
      p.tipo_producto,
      p.presentacion,
      p.unidad,
      p.es_derivado,
      p.producto_padre_id,
      p.factor_conversion,
      d.factor_conversion_derivado,
      d.producto_derivado_nombre,
      d.unidad_derivada,
      i.cantidad_actual,
      i.cantidad_minima,
      i.cantidad_maxima
    FROM inventario i
    INNER JOIN productos p ON p.id = i.producto_id
    INNER JOIN tiendas t ON t.id = i.tienda_id
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
    WHERE i.tienda_id = ?
    ORDER BY p.nombre ASC
  `;

  db.all(query, [tiendaId], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener inventario",
      });
    }

    res.json(rows);
  });
});

router.get(
  "/alertas-minimas/:tiendaId",
  verificarToken,
  (req, res) => {
    const { tiendaId } = req.params;

    const query = `
      SELECT
        i.id,
        i.tienda_id,
        t.nombre AS tienda,
        p.id AS producto_id,
        p.nombre AS producto,
        p.codigo_barras,
        p.tipo_producto,
        p.presentacion,
        p.unidad,
        p.es_derivado,
        p.factor_conversion,
        i.cantidad_actual,
        i.cantidad_minima,
        i.cantidad_maxima
      FROM inventario i
      INNER JOIN productos p ON p.id = i.producto_id
      INNER JOIN tiendas t ON t.id = i.tienda_id
      WHERE i.tienda_id = ?
      AND p.activo = 1
      AND i.cantidad_minima > 0
      AND i.cantidad_actual <= i.cantidad_minima
      ORDER BY i.cantidad_actual ASC, p.nombre ASC
    `;

    db.all(query, [tiendaId], (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener alertas de inventario",
        });
      }

      res.json(rows);
    });
  }
);

router.put(
  "/:id/limites",
  verificarToken,
  permitirRoles("administrador"),
  (req, res) => {

    const { id } = req.params;
    const { cantidad_minima, cantidad_maxima } = req.body;

    if (cantidad_minima == null || cantidad_maxima == null) {
      return res.status(400).json({
        error: "Mínimo y máximo son obligatorios",
      });
    }

    if (Number(cantidad_minima) < 0 || Number(cantidad_maxima) < 0) {
      return res.status(400).json({
        error: "Los límites no pueden ser negativos",
      });
    }

    if (Number(cantidad_minima) > Number(cantidad_maxima)) {
      return res.status(400).json({
        error: "El mínimo no puede ser mayor al máximo",
      });
    }

    const query = `
      UPDATE inventario
      SET
        cantidad_minima = ?,
        cantidad_maxima = ?,
        ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(
      query,
      [cantidad_minima, cantidad_maxima, id],
      function (error) {
        if (error) {
          return res.status(500).json({
            error: "Error al actualizar límites",
          });
        }

        res.json({
          mensaje: "Límites actualizados correctamente",
        });
      }
    );
  }
);
module.exports = router;
