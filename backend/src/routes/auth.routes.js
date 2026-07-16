const express = require("express");
const { login, renovarSesion } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
router.post("/renovar", renovarSesion);

module.exports = router;
