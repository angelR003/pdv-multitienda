const express = require("express");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  crearVenta,
  obtenerVentas,
  obtenerVentaPorId,
  obtenerDetalleVenta
} = require("../controllers/ventas.controller");

const router = express.Router();


router.get("/:id/detalle", verificarToken, obtenerDetalleVenta);

router.get(
  "/:id",
  verificarToken,
  obtenerVentaPorId
);
router.get("/", verificarToken, obtenerVentas);



router.post(
  "/",
  verificarToken,
  crearVenta
);

module.exports = router;