const express = require("express");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  obtenerProductosElegibles,
  obtenerPromociones,
  crearPromocion,
  desactivarPromocion,
  obtenerPromocionesActivasVenta,

} = require("../controllers/promociones.controller");

const router = express.Router();

router.get(
  "/productos-elegibles",
  verificarToken,
  obtenerProductosElegibles
);

router.get(
  "/",
  verificarToken,
  obtenerPromociones
);

router.get(
  "/activas",
  verificarToken,
  obtenerPromocionesActivasVenta
);

router.post(
  "/",
  verificarToken,
  crearPromocion
);

router.patch(
  "/:id/desactivar",
  verificarToken,
  desactivarPromocion
);

module.exports = router;