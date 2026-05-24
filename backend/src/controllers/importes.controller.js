const db = require("../database/connection");

const obtenerTiposEnvase = (req, res) => {
  db.all(
    `
    SELECT *
    FROM tipos_envase
    WHERE activo = 1
    ORDER BY categoria, nombre
    `,
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener tipos de envase",
        });
      }

      res.json(rows);
    }
  );
};

const registrarImporte = (req, res) => {
  const {
    tienda_id,
    cliente,
    cliente_fiado_id,
    tipo_envase_id,
    escenario,
    cantidad,
    observaciones,
  } = req.body;

  if (
    !tienda_id ||
    !cliente ||
    !tipo_envase_id ||
    !escenario ||
    !cantidad
  ) {
    return res.status(400).json({
      error: "Todos los campos son obligatorios",
    });
  }

  db.get(
    `
    SELECT *
    FROM tipos_envase
    WHERE id = ?
    `,
    [tipo_envase_id],
    (error, tipoEnvase) => {
      if (error || !tipoEnvase) {
        return res.status(404).json({
          error: "Tipo de envase no encontrado",
        });
      }

      const importeUnitario = Number(tipoEnvase.importe);
      const cantidadNumero = Number(cantidad);

      const importeTotal =
        escenario === "dejo_importe"
          ? importeUnitario * cantidadNumero
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
          req.usuario.id,
          cliente,
          cliente_fiado_id || null,
          tipo_envase_id,
          escenario,
          cantidadNumero,
          escenario === "trajo_envase" ? 0 : cantidadNumero,
          importeUnitario,
          importeTotal,
          escenario === "trajo_envase" ? "completado" : "pendiente",
          observaciones || null,
        ],
        function (error) {
          if (error) {
            return res.status(500).json({
              error: "Error al registrar importe",
            });
          }

          const responderOk = () => {
            return res.json({
              mensaje: "Importe registrado correctamente",
            });
          };

          if (escenario === "dejo_importe") {
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
                req.usuario.id,
                "entrada_dinero",
                importeTotal,
                "Importe envases",
                cliente,
              ],
              (error) => {
                if (error) {
                  return res.status(500).json({
                    error: "Error al registrar movimiento de caja",
                  });
                }

                return responderOk();
              }
            );

            return;
          }

          if (escenario === "trajo_envase") {
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
              [tienda_id, tipo_envase_id, cantidadNumero],
              (error) => {
                if (error) {
                  return res.status(500).json({
                    error: "Error al actualizar contador de envases",
                  });
                }

                return responderOk();
              }
            );

            return;
          }

          return responderOk();
        }
      );
    }
  );
};

const obtenerImportes = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT
      i.id,
      i.cliente,
      i.escenario,
      i.cantidad,
      i.cantidad_pendiente,
      i.importe_total,
      i.importe_unitario,
      i.estado,
      i.fecha_registro,
      i.observaciones,
      t.nombre AS tipo_envase
    FROM importes_envases i
    INNER JOIN tipos_envase t
      ON t.id = i.tipo_envase_id
    WHERE i.tienda_id = ?
    AND i.estado = 'pendiente'
    ORDER BY i.fecha_registro DESC
  `;

  db.all(query, [tienda_id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener importes",
      });
    }

    res.json(rows);
  });
};

const devolverImporte = (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  if (!cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({
      error: "Cantidad inválida",
    });
  }

  db.get(
    `
    SELECT *
    FROM importes_envases
    WHERE id = ?
    `,
    [id],
    (error, importe) => {
      if (error || !importe) {
        return res.status(404).json({
          error: "Importe no encontrado",
        });
      }

      if (Number(cantidad) > importe.cantidad_pendiente) {
        return res.status(400).json({
          error: "Cantidad excede pendientes",
        });
      }

      const nuevaCantidad =
        importe.cantidad_pendiente - Number(cantidad);

      const nuevoEstado =
        nuevaCantidad <= 0
          ? "completado"
          : "pendiente";

      const montoDevolver =
        Number(cantidad) *
        Number(importe.importe_unitario);

      db.run(
        `
        UPDATE importes_envases
        SET
          cantidad_pendiente = ?,
          estado = ?
        WHERE id = ?
        `,
        [
          nuevaCantidad,
          nuevoEstado,
          id,
        ],
        (error) => {
          if (error) {
            return res.status(500).json({
              error: "Error al actualizar importe",
            });
          }

          if (
            importe.escenario === "dejo_importe"
          ) {
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
                importe.tienda_id,
                req.usuario.id,
                "salida_dinero",
                montoDevolver,
                "Devolución importe",
                importe.cliente,
              ]
            );
          }

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
              cantidad_vacios =
                cantidad_vacios + excluded.cantidad_vacios
            `,
            [
              importe.tienda_id,
              importe.tipo_envase_id,
              Number(cantidad),
            ]
          );

          res.json({
            mensaje:
              "Envases recibidos correctamente",
          });
        }
      );
    }
  );
};
const obtenerInventarioEnvases = (req, res) => {
  const { tienda_id } = req.query;

  if (!tienda_id) {
    return res.status(400).json({
      error: "tienda_id es obligatorio",
    });
  }

  const query = `
    SELECT
      t.id,
      t.categoria,
      t.nombre,
      t.importe,
      COALESCE(i.cantidad_vacios, 0) AS cantidad_vacios
    FROM tipos_envase t
    LEFT JOIN inventario_envases i
      ON i.tipo_envase_id = t.id
      AND i.tienda_id = ?
    WHERE t.activo = 1
    ORDER BY t.categoria, t.nombre
  `;

  db.all(query, [tienda_id], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener inventario de envases",
      });
    }

    res.json(rows);
  });
};

module.exports = {
  obtenerTiposEnvase,
  registrarImporte,
  obtenerImportes,
  devolverImporte,
  obtenerInventarioEnvases,
};