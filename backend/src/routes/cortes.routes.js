const express = require("express");
const { verificarToken } = require("../middlewares/auth.middleware");
const { permitirRoles } = require("../middlewares/roles.middleware");

const {
  crearCorteCaja,
  obtenerCortes,
  obtenerResumenCorteCaja,
} = require("../controllers/cortes.controller");

const router = express.Router();

router.get(
  "/resumen",
  verificarToken,
  permitirRoles("administrador"),
  obtenerResumenCorteCaja
);

router.get("/", verificarToken, permitirRoles("administrador"), obtenerCortes);

router.post("/", verificarToken, crearCorteCaja);

module.exports = router;
