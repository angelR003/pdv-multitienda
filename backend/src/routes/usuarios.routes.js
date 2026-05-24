const express = require("express");


const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const {
  permitirRoles,
} = require("../middlewares/roles.middleware");

const router = express.Router();

const {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPasswordUsuario,
  cambiarEstadoUsuario,
  obtenerAccesosUsuario,
} = require("../controllers/usuarios.controller");

router.get(
  "/",
  verificarToken,
  permitirRoles("administrador"),
  obtenerUsuarios
);

router.get(
  "/:id/accesos",
  verificarToken,
  permitirRoles("administrador"),
  obtenerAccesosUsuario
);

router.post(
  "/",
  verificarToken,
  permitirRoles("administrador"),
  crearUsuario
);

router.put(
  "/:id",
  verificarToken,
  permitirRoles("administrador"),
  actualizarUsuario
);

router.patch(
  "/:id/password",
  verificarToken,
  permitirRoles("administrador"),
  cambiarPasswordUsuario
);

router.patch(
  "/:id/estado",
  verificarToken,
  permitirRoles("administrador"),
  cambiarEstadoUsuario
);

module.exports = router;