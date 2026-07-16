const db = require("../database/connection");
const {
  establecerSaldoFisico,
  resolverMovimiento,
} = require("../services/inventarioFisico.service");

const registrarAjusteInventario = (req, res) => {
  const {
    tienda_id,
    producto_id,
    cantidad_nueva,
    motivo,
    observaciones,
  } = req.body;

  const usuarioId = Number(req.usuario.id);
  const tiendaId = Number(tienda_id);
  const productoId = Number(producto_id);
  const cantidadNueva = Number(cantidad_nueva);
  const motivoLimpio = String(motivo || "").trim();
  const observacionesLimpias = String(observaciones || "").trim();

  if (
    !Number.isInteger(usuarioId) ||
    !Number.isInteger(tiendaId) ||
    tiendaId <= 0 ||
    !Number.isInteger(productoId) ||
    productoId <= 0 ||
    !Number.isFinite(cantidadNueva) ||
    !motivoLimpio
  ) {
    return res.status(400).json({ error: "Datos incompletos o inválidos" });
  }

  if (cantidadNueva < 0) {
    return res.status(400).json({ error: "La cantidad no puede ser negativa" });
  }

  // La existencia normal conserva la precision recibida. Solo la diferencia
  // de auditoria mantiene el redondeo historico a tres decimales.
  const cantidadNuevaNormalizada = cantidadNueva;

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION", (errorInicio) => {
      if (errorInicio) {
        return res.status(500).json({ error: "Error al iniciar el ajuste" });
      }

      const cancelar = (status, error) => {
        db.run("ROLLBACK", () => res.status(status).json({ error }));
      };

      resolverMovimiento(productoId, 1, {}, (errorImpacto, impacto) => {
        if (errorImpacto) {
          return cancelar(
            errorImpacto.status || 400,
            errorImpacto.message
          );
        }

        if (impacto.es_derivado) {
          return cancelar(
            400,
            `Ajusta el producto padre ${impacto.producto_fisico_nombre}`
          );
        }

        db.get(
          `
            SELECT cantidad_actual
            FROM inventario
            WHERE tienda_id = ? AND producto_id = ?
          `,
          [tiendaId, impacto.producto_fisico_id],
          (errorInventario, inventario) => {
            if (errorInventario) {
              return cancelar(500, "Error al obtener inventario");
            }

            if (!inventario) {
              return cancelar(404, "Inventario no encontrado");
            }

            const cantidadAnterior = Number(inventario.cantidad_actual);
            const diferencia = Number(
              (cantidadNuevaNormalizada - cantidadAnterior).toFixed(3)
            );

            establecerSaldoFisico(
              tiendaId,
              impacto,
              cantidadNuevaNormalizada,
              (errorActualizar) => {
                if (errorActualizar) {
                  return cancelar(
                    errorActualizar.status || 500,
                    errorActualizar.message || "Error al actualizar inventario"
                  );
                }

                db.run(
            `
                  INSERT INTO ajustes_inventario (
                    tienda_id, usuario_id, producto_id,
                    cantidad_anterior, cantidad_nueva, diferencia,
                    motivo, observaciones
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
                  [
                    tiendaId,
                    usuarioId,
                    impacto.producto_fisico_id,
                    cantidadAnterior,
                    cantidadNuevaNormalizada,
                    diferencia,
                    motivoLimpio,
                    observacionesLimpias || null,
                  ],
                  function (errorAjuste) {
                    if (errorAjuste) {
                      return cancelar(500, "Error al registrar ajuste");
                    }

                    const ajusteId = this.lastID;

                    db.run("COMMIT", (errorCommit) => {
                      if (errorCommit) {
                        return cancelar(500, "Error al confirmar el ajuste");
                      }

                      res.status(201).json({
                        mensaje: "Ajuste realizado correctamente",
                        ajuste_id: ajusteId,
                        cantidad_anterior: cantidadAnterior,
                        cantidad_nueva: cantidadNuevaNormalizada,
                        diferencia,
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  });
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
    INNER JOIN productos p ON p.id = a.producto_id
    INNER JOIN tiendas t ON t.id = a.tienda_id
    INNER JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.fecha_ajuste DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({ error: "Error al obtener ajustes" });
    }

    res.json(rows);
  });
};

module.exports = {
  registrarAjusteInventario,
  obtenerAjustesInventario,
};
