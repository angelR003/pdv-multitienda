const express = require("express");

const {
  registrarEntrada,
  obtenerEntradas,
} = require("../controllers/entradas.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", verificarToken, obtenerEntradas);
router.post("/", verificarToken, registrarEntrada);

module.exports = router;