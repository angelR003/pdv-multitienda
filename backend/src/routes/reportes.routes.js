const express = require("express");

const { verificarToken } = require("../middlewares/auth.middleware");
const { permitirRoles } = require("../middlewares/roles.middleware");

const {
  obtenerTiendas,
  obtenerResumenReportes,
} = require("../controllers/reportes.controller");

const router = express.Router();

router.get(
  "/tiendas",
  verificarToken,
  permitirRoles("administrador"),
  obtenerTiendas
);

router.get(
  "/resumen",
  verificarToken,
  permitirRoles("administrador"),
  obtenerResumenReportes
);

module.exports = router;