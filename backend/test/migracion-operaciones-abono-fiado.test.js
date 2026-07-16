"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sqlite3 = require("sqlite3").verbose();

const {
  migrarOperacionesAbonoFiado,
  verificarEsquemaOperacionesAbonoFiado,
} = require("../src/database/migrar-operaciones-abono-fiado");

const loggerSilencioso = {
  log() {},
  error() {},
};

function abrirMemoria() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(":memory:", (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function ejecutar(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function consultarUno(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, fila) => {
      if (error) reject(error);
      else resolve(fila);
    });
  });
}

function cerrar(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("primera ejecucion crea y valida operaciones_abono_fiado", async () => {
  const db = await abrirMemoria();

  try {
    const resultado = await migrarOperacionesAbonoFiado(db, {
      logger: loggerSilencioso,
    });

    assert.equal(resultado.estado, "creada");
    assert.deepEqual(resultado.columnas, [
      "operation_id",
      "payload_hash",
      "cliente_id",
      "abono_id",
      "movimiento_caja_id",
      "respuesta_json",
      "fecha_creacion",
    ]);
    await verificarEsquemaOperacionesAbonoFiado(db);
  } finally {
    await cerrar(db);
  }
});

test("segunda ejecucion es idempotente y no altera datos ni esquema", async () => {
  const db = await abrirMemoria();

  try {
    await migrarOperacionesAbonoFiado(db, { logger: loggerSilencioso });
    await ejecutar(
      db,
      `
        INSERT INTO operaciones_abono_fiado (
          operation_id, payload_hash, cliente_id, abono_id,
          movimiento_caja_id, respuesta_json
        ) VALUES ('operacion-prueba', 'hash', 1, 2, 3, '{}')
      `
    );

    const versionAntes = await consultarUno(db, "PRAGMA schema_version");
    const cambiosAntes = db.totalChanges;
    const resultado = await migrarOperacionesAbonoFiado(db, {
      logger: loggerSilencioso,
    });
    const versionDespues = await consultarUno(db, "PRAGMA schema_version");
    const conteo = await consultarUno(
      db,
      "SELECT COUNT(*) AS total FROM operaciones_abono_fiado"
    );

    assert.equal(resultado.estado, "existente_compatible");
    assert.deepEqual(versionDespues, versionAntes);
    assert.equal(db.totalChanges, cambiosAntes);
    assert.equal(conteo.total, 1);
  } finally {
    await cerrar(db);
  }
});

test("tabla homonima incompatible bloquea la migracion explicitamente", async () => {
  const db = await abrirMemoria();

  try {
    await ejecutar(
      db,
      "CREATE TABLE operaciones_abono_fiado (operation_id TEXT PRIMARY KEY)"
    );

    await assert.rejects(
      migrarOperacionesAbonoFiado(db, { logger: loggerSilencioso }),
      (error) =>
        error.code === "TABLA_OPERACIONES_ABONO_INCOMPATIBLE" &&
        /incompatible/i.test(error.message)
    );

    const columnas = await consultarUno(
      db,
      "SELECT COUNT(*) AS total FROM pragma_table_info('operaciones_abono_fiado')"
    );
    assert.equal(columnas.total, 1);
  } finally {
    await cerrar(db);
  }
});

test("restricciones unicas y NOT NULL quedan activas", async () => {
  const db = await abrirMemoria();

  try {
    await migrarOperacionesAbonoFiado(db, { logger: loggerSilencioso });
    await ejecutar(
      db,
      `
        INSERT INTO operaciones_abono_fiado (
          operation_id, payload_hash, cliente_id, abono_id,
          movimiento_caja_id, respuesta_json
        ) VALUES ('operacion-base', 'hash', 1, 10, 20, '{}')
      `
    );

    await assert.rejects(
      ejecutar(
        db,
        `INSERT INTO operaciones_abono_fiado
          VALUES ('operacion-abono', 'hash', 1, 10, 21, '{}', CURRENT_TIMESTAMP)`
      ),
      /UNIQUE constraint failed/
    );
    await assert.rejects(
      ejecutar(
        db,
        `INSERT INTO operaciones_abono_fiado
          VALUES ('operacion-caja', 'hash', 1, 11, 20, '{}', CURRENT_TIMESTAMP)`
      ),
      /UNIQUE constraint failed/
    );
    await assert.rejects(
      ejecutar(
        db,
        `INSERT INTO operaciones_abono_fiado
          VALUES ('operacion-null', NULL, 1, 11, 21, '{}', CURRENT_TIMESTAMP)`
      ),
      /NOT NULL constraint failed/
    );
  } finally {
    await cerrar(db);
  }
});
