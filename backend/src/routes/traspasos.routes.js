const express = require("express");

const { verificarToken } = require("../middlewares/auth.middleware");

const {
  obtenerTiendas,
  obtenerProductosParaTraspaso,
  obtenerNotificacionesTraspasos,
  listarTraspasos,
  obtenerTraspasoPorId,
  crearTraspaso,
  recibirTraspaso,
  cancelarTraspaso,
} = require("../controllers/traspasos.controller");

const router = express.Router();

router.get("/tiendas", verificarToken, obtenerTiendas);
router.get("/productos", verificarToken, obtenerProductosParaTraspaso);
router.get("/notificaciones", verificarToken, obtenerNotificacionesTraspasos);
router.get("/", verificarToken, listarTraspasos);
router.get("/:id", verificarToken, obtenerTraspasoPorId);
router.post("/", verificarToken, crearTraspaso);
router.patch("/:id/recibir", verificarToken, recibirTraspaso);
router.patch("/:id/cancelar", verificarToken, cancelarTraspaso);

module.exports = router;
