"use strict";

const NOMBRE_TABLA = "operaciones_abono_fiado";

const SQL_CREACION = `
  CREATE TABLE IF NOT EXISTS operaciones_abono_fiado (
    operation_id TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    cliente_id INTEGER NOT NULL,
    abono_id INTEGER NOT NULL UNIQUE,
    movimiento_caja_id INTEGER NOT NULL UNIQUE,
    respuesta_json TEXT NOT NULL,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const COLUMNAS_ESPERADAS = [
  { nombre: "operation_id", tipo: "TEXT", notnull: 0, pk: 1, default: null },
  { nombre: "payload_hash", tipo: "TEXT", notnull: 1, pk: 0, default: null },
  { nombre: "cliente_id", tipo: "INTEGER", notnull: 1, pk: 0, default: null },
  { nombre: "abono_id", tipo: "INTEGER", notnull: 1, pk: 0, default: null },
  {
    nombre: "movimiento_caja_id",
    tipo: "INTEGER",
    notnull: 1,
    pk: 0,
    default: null,
  },
  { nombre: "respuesta_json", tipo: "TEXT", notnull: 1, pk: 0, default: null },
  {
    nombre: "fecha_creacion",
    tipo: "TEXT",
    notnull: 1,
    pk: 0,
    default: "CURRENT_TIMESTAMP",
  },
];

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

function consultarTodos(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, filas) => {
      if (error) reject(error);
      else resolve(filas);
    });
  });
}

function normalizarDefault(valor) {
  if (valor == null) return null;

  let normalizado = String(valor).trim().toUpperCase();
  while (normalizado.startsWith("(") && normalizado.endsWith(")")) {
    normalizado = normalizado.slice(1, -1).trim();
  }

  return normalizado;
}

function errorIncompatibilidad(detalles) {
  const error = new Error(
    `La tabla ${NOMBRE_TABLA} es incompatible: ${detalles.join("; ")}`
  );
  error.code = "TABLA_OPERACIONES_ABONO_INCOMPATIBLE";
  return error;
}

async function obtenerColumnasIndice(db, nombreIndice) {
  const nombreSeguro = String(nombreIndice).replace(/"/g, '""');
  const filas = await consultarTodos(db, `PRAGMA index_info("${nombreSeguro}")`);
  return filas
    .slice()
    .sort((a, b) => Number(a.seqno) - Number(b.seqno))
    .map((fila) => fila.name);
}

async function verificarEsquemaOperacionesAbonoFiado(db) {
  const tabla = await consultarUno(
    db,
    "SELECT type, sql FROM sqlite_master WHERE name = ?",
    [NOMBRE_TABLA]
  );

  if (!tabla || tabla.type !== "table") {
    throw errorIncompatibilidad(["no existe como tabla"]);
  }

  const problemas = [];
  const columnas = await consultarTodos(
    db,
    `PRAGMA table_info("${NOMBRE_TABLA}")`
  );

  if (columnas.length !== COLUMNAS_ESPERADAS.length) {
    problemas.push(
      `se esperaban ${COLUMNAS_ESPERADAS.length} columnas y existen ${columnas.length}`
    );
  }

  COLUMNAS_ESPERADAS.forEach((esperada, indice) => {
    const actual = columnas[indice];
    if (!actual) {
      problemas.push(`falta la columna ${esperada.nombre}`);
      return;
    }

    if (actual.name !== esperada.nombre) {
      problemas.push(
        `columna ${indice + 1}: se esperaba ${esperada.nombre} y existe ${actual.name}`
      );
    }
    if (String(actual.type || "").toUpperCase() !== esperada.tipo) {
      problemas.push(
        `${esperada.nombre}: tipo esperado ${esperada.tipo}, actual ${actual.type || "vacio"}`
      );
    }
    if (Number(actual.notnull) !== esperada.notnull) {
      problemas.push(
        `${esperada.nombre}: NOT NULL esperado ${esperada.notnull}, actual ${actual.notnull}`
      );
    }
    if (Number(actual.pk) !== esperada.pk) {
      problemas.push(
        `${esperada.nombre}: clave primaria esperada ${esperada.pk}, actual ${actual.pk}`
      );
    }
    if (normalizarDefault(actual.dflt_value) !== esperada.default) {
      problemas.push(
        `${esperada.nombre}: default esperado ${esperada.default}, actual ${actual.dflt_value}`
      );
    }
  });

  const indices = await consultarTodos(
    db,
    `PRAGMA index_list("${NOMBRE_TABLA}")`
  );
  const indicesUnicos = [];

  for (const indice of indices.filter((fila) => Number(fila.unique) === 1)) {
    indicesUnicos.push({
      origen: indice.origin,
      parcial: Number(indice.partial || 0),
      columnas: await obtenerColumnasIndice(db, indice.name),
    });
  }

  const firmaIndices = indicesUnicos
    .map((indice) => `${indice.origen}:${indice.parcial}:${indice.columnas.join(",")}`)
    .sort();
  const firmaEsperada = [
    "pk:0:operation_id",
    "u:0:abono_id",
    "u:0:movimiento_caja_id",
  ].sort();

  if (JSON.stringify(firmaIndices) !== JSON.stringify(firmaEsperada)) {
    problemas.push(
      `indices unicos esperados ${firmaEsperada.join(" | ")}, actuales ${firmaIndices.join(" | ")}`
    );
  }

  const llavesForaneas = await consultarTodos(
    db,
    `PRAGMA foreign_key_list("${NOMBRE_TABLA}")`
  );
  if (llavesForaneas.length > 0) {
    problemas.push("contiene llaves foraneas no previstas");
  }

  if (/\b(CHECK|REFERENCES|WITHOUT\s+ROWID|STRICT)\b/i.test(tabla.sql || "")) {
    problemas.push("contiene restricciones adicionales no previstas");
  }

  if (problemas.length > 0) {
    throw errorIncompatibilidad(problemas);
  }

  return {
    tabla: NOMBRE_TABLA,
    columnas: columnas.map((columna) => columna.name),
    indices_unicos: firmaIndices,
  };
}

async function migrarOperacionesAbonoFiado(db, { logger = console } = {}) {
  if (!db || typeof db.run !== "function") {
    throw new TypeError("Se requiere una conexion SQLite valida");
  }

  let transaccionIniciada = false;

  try {
    await ejecutar(db, "BEGIN IMMEDIATE TRANSACTION");
    transaccionIniciada = true;

    const existente = await consultarUno(
      db,
      "SELECT type FROM sqlite_master WHERE name = ?",
      [NOMBRE_TABLA]
    );
    const creada = !existente;

    await ejecutar(db, SQL_CREACION);
    const esquema = await verificarEsquemaOperacionesAbonoFiado(db);
    await ejecutar(db, "COMMIT");
    transaccionIniciada = false;

    const resultado = {
      migracion: NOMBRE_TABLA,
      estado: creada ? "creada" : "existente_compatible",
      ...esquema,
    };

    logger.log(
      `[migracion:${NOMBRE_TABLA}] ${resultado.estado}; esquema validado`
    );
    return resultado;
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await ejecutar(db, "ROLLBACK");
      } catch (errorRollback) {
        error.rollbackError = errorRollback;
      }
    }

    logger.error(`[migracion:${NOMBRE_TABLA}] ERROR: ${error.message}`);
    throw error;
  }
}

module.exports = {
  NOMBRE_TABLA,
  SQL_CREACION,
  migrarOperacionesAbonoFiado,
  verificarEsquemaOperacionesAbonoFiado,
};
