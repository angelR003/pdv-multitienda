const express = require("express");

const {
  crearClienteFiado,
  obtenerClientesFiado,
  registrarFiado,
  registrarAbono,
  obtenerHistorialCliente,
} = require("../controllers/fiados.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/clientes",
  verificarToken,
  obtenerClientesFiado
);

router.post(
  "/clientes",
  verificarToken,
  crearClienteFiado
);

router.post(
  "/registrar",
  verificarToken,
  registrarFiado
);

router.post(
  "/abono",
  verificarToken,
  registrarAbono
);

router.get(
  "/historial/:id",
  verificarToken,
  obtenerHistorialCliente
);

module.exports = router;