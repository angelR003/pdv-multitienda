const express = require("express");

const {
  crearCorteCaja,
  obtenerCortes,
} = require("../controllers/cortes.controller");

const router = express.Router();

router.get("/", obtenerCortes);

router.post("/", crearCorteCaja);

module.exports = router;