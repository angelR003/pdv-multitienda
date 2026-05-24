const express = require("express");

const {
  registrarMovimientoCaja,
  obtenerMovimientosCaja,
} = require("../controllers/movimientosCaja.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", verificarToken, obtenerMovimientosCaja);
router.post("/", verificarToken, registrarMovimientoCaja);

module.exports = router;