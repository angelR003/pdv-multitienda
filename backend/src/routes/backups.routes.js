const express = require("express");

const {
  crearBackupManual,
} = require("../controllers/backups.controller");

const {
  verificarToken,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", verificarToken, crearBackupManual);

module.exports = router;