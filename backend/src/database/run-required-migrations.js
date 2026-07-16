"use strict";

const {
  migrarOperacionesAbonoFiado,
} = require("./migrar-operaciones-abono-fiado");

async function runRequiredMigrations({ db, logger = console }) {
  if (!db) {
    throw new TypeError("runRequiredMigrations requiere una conexion SQLite");
  }

  logger.log("[migraciones-requeridas] inicio");
  const operacionesAbono = await migrarOperacionesAbonoFiado(db, { logger });
  logger.log("[migraciones-requeridas] completadas");

  return [operacionesAbono];
}

module.exports = {
  runRequiredMigrations,
};
