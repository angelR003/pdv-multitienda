const express = require("express");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  permitirRoles,
} = require("../middlewares/roles.middleware");
const {
  obtenerProductos,
  obtenerProductoPorCodigo,
  obtenerProductosVentaManual,
  crearProducto,
  obtenerProductoPorId,
  actualizarProducto,
  desactivarProducto,
  obtenerTodosProductosAdmin,
  activarProducto,
} = require("../controllers/productos.controller");

const router = express.Router();
router.get(
  "/",
  verificarToken,
  obtenerProductos
);

router.get(
  "/manuales",
  verificarToken,
  obtenerProductosVentaManual
);

router.get(
  "/codigo/:codigo",
  verificarToken,
  obtenerProductoPorCodigo
);


router.get(
  "/admin",
  verificarToken,
  permitirRoles("administrador"),
  obtenerTodosProductosAdmin
);

router.patch(
  "/:id/activar",
  verificarToken,
  permitirRoles("administrador"),
  activarProducto
);
router.put("/:id", verificarToken, actualizarProducto);


router.get("/:id", verificarToken, obtenerProductoPorId);

router.post(
  "/",
  verificarToken,
  crearProducto
);

router.patch("/:id/desactivar", verificarToken, desactivarProducto);

module.exports = router;
