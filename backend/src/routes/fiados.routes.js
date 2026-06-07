const express = require("express");

const {
  crearClienteFiado,
  obtenerClientesFiado,
  actualizarClienteFiado,
  desactivarClienteFiado,
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

router.patch(
  "/clientes/:id",
  verificarToken,
  actualizarClienteFiado
);

router.patch(
  "/clientes/:id/desactivar",
  verificarToken,
  desactivarClienteFiado
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
