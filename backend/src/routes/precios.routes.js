const express = require("express");
const db = require("../database/connection");

const router = express.Router();

router.post("/especial", (req, res) => {
  const {
    producto_id,
    tienda_id,
    precio_especial,
    usuario_admin_id,
    motivo,
  } = req.body;

  const query = `
    INSERT INTO precios_tienda (
      producto_id,
      tienda_id,
      precio_especial,
      usuario_admin_id,
      motivo
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      producto_id,
      tienda_id,
      precio_especial,
      usuario_admin_id,
      motivo,
    ],
    function (error) {
      if (error) {
        return res.status(500).json({
          error: error.message,
        });
      }

      res.status(201).json({
        mensaje: "Precio especial creado",
        id: this.lastID,
      });
    }
  );
});

module.exports = router;