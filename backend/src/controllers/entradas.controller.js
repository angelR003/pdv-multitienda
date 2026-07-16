const db = require("../database/connection");
const {
  resolverMovimiento,
  sumarInventario,
} = require("../services/inventarioFisico.service");

const registrarEntrada = (req, res) => {
  const {
    tienda_id,
    usuario_id,
    proveedor,
    producto_id,
    cantidad,
    costo_unitario,
    observaciones,
  } = req.body;

  if (!tienda_id || !usuario_id || !producto_id || !cantidad || cantidad <= 0) {
    return res.status(400).json({
      error: "Tienda, usuario, producto y cantidad son obligatorios",
    });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION", (errorInicio) => {
      if (errorInicio) {
        return res.status(500).json({
          error: "Error al iniciar la entrada",
        });
      }

      resolverMovimiento(
        producto_id,
        cantidad,
        {},
        (errorImpacto, impacto) => {
          if (errorImpacto) {
            return rollback(res, errorImpacto.message);
          }

          if (impacto.es_derivado) {
            return rollback(
              res,
              `Registra la entrada en el producto padre ${impacto.producto_fisico_nombre}`
            );
          }

          db.run(
            `
              INSERT INTO entradas_mercancia (
                tienda_id,
                usuario_id,
                proveedor,
                observaciones
              )
              VALUES (?, ?, ?, ?)
            `,
            [
              tienda_id,
              usuario_id,
              proveedor || null,
              observaciones || null,
            ],
            function (errorEntrada) {
              if (errorEntrada) {
                return rollback(res, "Error al registrar entrada");
              }

              const entradaId = this.lastID;

              db.run(
                `
                  INSERT INTO entrada_detalles (
                    entrada_id,
                    producto_id,
                    cantidad,
                    costo_unitario
                  )
                  VALUES (?, ?, ?, ?)
                `,
                [
                  entradaId,
                  producto_id,
                  cantidad,
                  costo_unitario || 0,
                ],
                (errorDetalle) => {
                  if (errorDetalle) {
                    return rollback(
                      res,
                      "Error al registrar detalle de entrada"
                    );
                  }

                  sumarInventario(
                    tienda_id,
                    impacto,
                    (errorInventario) => {
                      if (errorInventario) {
                        return rollback(
                          res,
                          "Error al actualizar inventario"
                        );
                      }

                      db.run("COMMIT", (errorCommit) => {
                        if (errorCommit) {
                          return rollback(
                            res,
                            "Error al confirmar entrada"
                          );
                        }

                        res.status(201).json({
                          mensaje: "Entrada registrada correctamente",
                          entrada_id: entradaId,
                        });
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
};

const obtenerEntradas = (req, res) => {
  const query = `
    SELECT
      e.id,
      t.nombre AS tienda,
      u.nombre AS usuario,
      e.proveedor,
      e.observaciones,
      e.fecha_entrada
    FROM entradas_mercancia e
    INNER JOIN tiendas t ON t.id = e.tienda_id
    INNER JOIN usuarios u ON u.id = e.usuario_id
    ORDER BY e.fecha_entrada DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return res.status(500).json({
        error: "Error al obtener entradas",
      });
    }

    res.json(rows);
  });
};

const rollback = (res, mensaje) => {
  db.run("ROLLBACK", () => {
    return res.status(400).json({
      error: mensaje,
    });
  });
};

module.exports = {
  registrarEntrada,
  obtenerEntradas,
};
