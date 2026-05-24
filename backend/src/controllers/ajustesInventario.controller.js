const db = require("../database/connection");

const registrarAjusteInventario = (req, res) => {
  const {
    tienda_id,
    usuario_id,
    producto_id,
    cantidad_nueva,
    motivo,
    observaciones,
  } = req.body;

  if (
    !tienda_id ||
    !usuario_id ||
    !producto_id ||
    cantidad_nueva == null ||
    !motivo
  ) {
    return res.status(400).json({
      error: "Datos incompletos",
    });
  }

  const queryInventario = `
    SELECT cantidad_actual
    FROM inventario
    WHERE tienda_id = ?
    AND producto_id = ?
  `;

  db.get(
    queryInventario,
    [tienda_id, producto_id],
    (errorInventario, inventario) => {
      if (errorInventario) {
        return res.status(500).json({
          error: "Error al obtener inventario",
        });
      }

      if (!inventario) {
        return res.status(404).json({
          error: "Inventario no encontrado",
        });
      }

      const cantidadAnterior = Number(inventario.cantidad_actual);

      const cantidadNueva = Number(cantidad_nueva);

      const diferencia = Number(
        (cantidadNueva - cantidadAnterior).toFixed(3)
      );

      const queryActualizar = `
        UPDATE inventario
        SET cantidad_actual = ?
        WHERE tienda_id = ?
        AND producto_id = ?
      `;

      db.run(
        queryActualizar,
        [cantidadNueva, tienda_id, producto_id],
        (errorActualizar) => {
          if (errorActualizar) {
            return res.status(500).json({
              error: "Error al actualizar inventario",
            });
          }

          const queryAjuste = `
            INSERT INTO ajustes_inventario (
              tienda_id,
              usuario_id,
              producto_id,
              cantidad_anterior,
              cantidad_nueva,
              diferencia,
              motivo,
              observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.run(
            queryAjuste,
            [
              tienda_id,
              usuario_id,
              producto_id,
              cantidadAnterior,
              cantidadNueva,
              diferencia,
              motivo,
              observaciones || null,
            ],
            function (errorAjuste) {
              if (errorAjuste) {
                return res.status(500).json({
                  error: "Error al registrar ajuste",
                });
              }

              res.status(201).json({
                mensaje: "Ajuste realizado correctamente",
                ajuste_id: this.lastID,
                cantidad_anterior: cantidadAnterior,
                cantidad_nueva: cantidadNueva,
                diferencia,
              });
            }
          );
        }
      );
    }
  );
};

const obtenerAjustesInventario = (req, res) => {
  const query = `
    SELECT
      a.id,
      p.nombre AS producto,
      t.nombre AS tienda,
      u.nombre AS usuario,

      a.cantidad_anterior,
      a.cantidad_nueva,
      a.diferencia,

      a.motivo,
      a.observaciones,
      a.fecha_ajuste

    FROM ajustes_inventario a

    INNER JOIN productos p
      ON p.id = a.producto_id

    INNER JOIN tiendas t
      ON t.id = a.tienda_id

    INNER JOIN usuarios u
      ON u.id = a.usuario_id

    ORDER BY a.fecha_ajuste DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener ajustes",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  registrarAjusteInventario,
  obtenerAjustesInventario,
};