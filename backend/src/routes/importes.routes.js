const express = require("express");

const router = express.Router();

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  obtenerTiposEnvase,
  registrarImporte,
  obtenerImportes,
devolverImporte,
obtenerInventarioEnvases,
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