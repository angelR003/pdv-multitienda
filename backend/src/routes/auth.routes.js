const express = require("express");
const { login, renovarSesion } = require("../controllers/auth.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/renovar", verificarToken, renovarSesion);

module.exports = router;
