const express = require("express");

const {
  registrarDevolucion,
  registrarDevolucionRenglon,
  obtenerHistorialDevolucionesVenta,

} = require("../controllers/devoluciones.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/venta/:venta_id",
  verificarToken,
  obtenerHistorialDevolucionesVenta
);

router.post("/", verificarToken, registrarDevolucion);

router.post("/renglon", verificarToken, registrarDevolucionRenglon);

module.exports = router;