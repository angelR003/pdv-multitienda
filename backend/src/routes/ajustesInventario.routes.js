const express = require("express");

const {
  registrarAjusteInventario,
  obtenerAjustesInventario,
} = require("../controllers/ajustesInventario.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  permitirRoles,
} = require("../middlewares/roles.middleware");

const router = express.Router();

router.get("/", verificarToken, permitirRoles("administrador"), obtenerAjustesInventario);

router.post("/", verificarToken, permitirRoles("administrador"), registrarAjusteInventario);

module.exports = router;
