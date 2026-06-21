const express = require("express");

const router = express.Router();

const {
  verificarToken,
} = require("../middlewares/auth.middleware");
const {
  permitirRoles,
} = require("../middlewares/roles.middleware");

const {
  obtenerTiposEnvase,
  registrarImporte,
  obtenerImportes,
  devolverImporte,
  obtenerInventarioEnvases,
  actualizarConfiguracionCajaEnvase,
  actualizarConfiguracionEnvase,
  registrarAjusteEnvases,
  obtenerAjustesEnvases,
} = require("../controllers/importes.controller");

router.get(
  "/tipos-envase",
  verificarToken,
  obtenerTiposEnvase
);
router.get(
  "/",
  verificarToken,
  obtenerImportes
);

router.get(
  "/inventario-envases",
  verificarToken,
  obtenerInventarioEnvases
);

router.get(
  "/ajustes-envases",
  verificarToken,
  obtenerAjustesEnvases
);

router.post(
  "/ajustes-envases",
  verificarToken,
  registrarAjusteEnvases
);

router.patch(
  "/tipos-envase/:id/caja",
  verificarToken,
  permitirRoles("administrador"),
  actualizarConfiguracionCajaEnvase
);

router.patch(
  "/tipos-envase/:id/configuracion",
  verificarToken,
  permitirRoles("administrador"),
  actualizarConfiguracionEnvase
);

router.post(
  "/:id/devolver",
  verificarToken,
  devolverImporte
);
router.post(
  "/",
  verificarToken,
  registrarImporte
);

module.exports = router;
