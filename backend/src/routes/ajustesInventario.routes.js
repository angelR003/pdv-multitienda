const express = require("express");

const {
  registrarAjusteInventario,
  obtenerAjustesInventario,
} = require("../controllers/ajustesInventario.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", verificarToken, obtenerAjustesInventario);

router.post("/", verificarToken, registrarAjusteInventario);

module.exports = router;