const express = require("express");

const {
  registrarDevolucion,
} = require("../controllers/devoluciones.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", verificarToken, registrarDevolucion);

module.exports = router;