const express = require("express");
const db = require("../database/connection");
const {
  calcularDisponibilidadComercial,
} = require("../services/inventarioFisico.service");

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
      CASE WHEN p.es_derivado = 1 THEN NULL ELSE i.id END AS id,
      i.id AS inventario_fisico_id,
      t.id AS tienda_id,
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
      padre.nombre AS producto_fisico_nombre,
      padre.unidad AS unidad_fisica,
      padre.es_derivado AS padre_es_derivado,
      CASE
        WHEN p.es_derivado = 1 THEN p.producto_padre_id
        ELSE p.id
      END AS producto_fisico_id,
      d.factor_conversion_derivado,
      d.producto_derivado_nombre,
      d.unidad_derivada,
      COALESCE(i.cantidad_actual, 0) AS cantidad_fisica_autoritativa,
      COALESCE(i.cantidad_minima, 0) AS cantidad_minima_fisica,
      COALESCE(i.cantidad_maxima, 0) AS cantidad_maxima_fisica,
      i_legacy.id AS inventario_legacy_id,
      i_legacy.cantidad_actual AS cantidad_legacy_hijo
    FROM tiendas t
    INNER JOIN productos p ON p.activo = 1
    LEFT JOIN productos padre ON padre.id = p.producto_padre_id
    LEFT JOIN inventario i
      ON i.tienda_id = t.id
      AND i.producto_id = CASE
        WHEN p.es_derivado = 1 THEN p.producto_padre_id
        ELSE p.id
      END
    LEFT JOIN inventario i_legacy
      ON i_legacy.tienda_id = t.id
      AND i_legacy.producto_id = p.id
      AND p.es_derivado = 1
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
    WHERE t.id = ?
      AND (p.es_derivado = 1 OR i.id IS NOT NULL)
    ORDER BY p.nombre ASC
  `;

  db.all(query, [tiendaId], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener inventario",
      });
    }

    const inventario = rows.map((item) => {
      const esDerivado = Number(item.es_derivado || 0) === 1;
      const tieneFilaLegacy = item.inventario_legacy_id != null;
      let disponibilidadComercial = Number(
        item.cantidad_fisica_autoritativa || 0
      );
      let minimoComercial = Number(item.cantidad_minima_fisica || 0);
      let maximoComercial = Number(item.cantidad_maxima_fisica || 0);

      if (esDerivado) {
        try {
          disponibilidadComercial = calcularDisponibilidadComercial(
            item.cantidad_fisica_autoritativa,
            item.factor_conversion
          );
          minimoComercial = calcularDisponibilidadComercial(
            item.cantidad_minima_fisica,
            item.factor_conversion
          );
          maximoComercial = calcularDisponibilidadComercial(
            item.cantidad_maxima_fisica,
            item.factor_conversion
          );
        } catch (errorFactor) {
          disponibilidadComercial = 0;
          minimoComercial = 0;
          maximoComercial = 0;
        }
      }

      return {
        ...item,
        cantidad_actual: disponibilidadComercial,
        cantidad_minima: minimoComercial,
        cantidad_maxima: maximoComercial,
        es_vista_derivada: esDerivado ? 1 : 0,
        es_diagnostico_legacy: tieneFilaLegacy ? 1 : 0,
        inventario_autoritativo: esDerivado ? "padre" : "propio",
        cantidad_comercial_disponible: disponibilidadComercial,
        diagnostico:
          tieneFilaLegacy
            ? `Fila legacy no autoritativa con saldo ${item.cantidad_legacy_hijo}`
            : null,
      };
    });

    res.json(inventario);
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
      AND p.es_derivado = 0
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
      AND EXISTS (
        SELECT 1
        FROM productos p
        WHERE p.id = inventario.producto_id
        AND p.es_derivado = 0
      )
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

        if (this.changes !== 1) {
          return res.status(400).json({
            error: "Solo se pueden editar limites del inventario fisico",
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
