const { crearBackup } = require("../utils/backup");

const crearBackupManual = (req, res) => {
  try {
    const ruta = crearBackup();

    res.status(201).json({
      mensaje: "Backup creado correctamente",
      ruta,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Error al crear backup",
    });
  }
};

module.exports = {
  crearBackupManual,
};