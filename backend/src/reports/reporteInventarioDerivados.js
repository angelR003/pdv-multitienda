"use strict";

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const EPSILON_DISPONIBILIDAD = 1e-9;

const CONSULTA_REPORTE_INVENTARIO_DERIVADOS = `
  WITH
  pares_derivados AS (
    SELECT
      hijo.id AS producto_derivado_id,
      hijo.nombre AS producto_derivado,
      hijo.activo AS producto_derivado_activo,
      hijo.producto_padre_id,
      padre.nombre AS producto_padre,
      padre.activo AS producto_padre_activo,
      CAST(hijo.factor_conversion AS REAL) AS factor_conversion
    FROM productos AS hijo
    LEFT JOIN productos AS padre
      ON padre.id = hijo.producto_padre_id
    WHERE COALESCE(hijo.es_derivado, 0) = 1
  ),
  inventario_agrupado AS (
    SELECT
      tienda_id,
      producto_id,
      COUNT(*) AS filas_inventario,
      COALESCE(SUM(CAST(cantidad_actual AS REAL)), 0) AS cantidad_actual
    FROM inventario
    GROUP BY tienda_id, producto_id
  ),
  entradas_hijo AS (
    SELECT
      entrada.tienda_id,
      detalle.producto_id,
      COUNT(DISTINCT entrada.id) AS entradas_conteo,
      COUNT(*) AS entradas_renglones,
      COALESCE(SUM(CAST(detalle.cantidad AS REAL)), 0) AS entradas_cantidad,
      MAX(entrada.fecha_entrada) AS ultima_entrada_fecha
    FROM entrada_detalles AS detalle
    INNER JOIN entradas_mercancia AS entrada
      ON entrada.id = detalle.entrada_id
    INNER JOIN productos AS producto
      ON producto.id = detalle.producto_id
     AND COALESCE(producto.es_derivado, 0) = 1
    GROUP BY entrada.tienda_id, detalle.producto_id
  ),
  ventas_hijo AS (
    SELECT
      venta.tienda_id,
      detalle.producto_id,
      COUNT(DISTINCT venta.id) AS ventas_conteo,
      COUNT(*) AS ventas_renglones,
      COALESCE(SUM(CAST(detalle.cantidad AS REAL)), 0) AS ventas_cantidad
    FROM venta_detalles AS detalle
    INNER JOIN ventas AS venta
      ON venta.id = detalle.venta_id
    INNER JOIN productos AS producto
      ON producto.id = detalle.producto_id
     AND COALESCE(producto.es_derivado, 0) = 1
    GROUP BY venta.tienda_id, detalle.producto_id
  ),
  ventas_hijo_ordenadas AS (
    SELECT
      venta.tienda_id,
      detalle.producto_id,
      venta.id AS venta_id,
      venta.folio AS venta_folio,
      venta.estado AS venta_estado,
      venta.fecha_venta,
      ROW_NUMBER() OVER (
        PARTITION BY venta.tienda_id, detalle.producto_id
        ORDER BY venta.fecha_venta DESC, venta.id DESC, detalle.id DESC
      ) AS posicion
    FROM venta_detalles AS detalle
    INNER JOIN ventas AS venta
      ON venta.id = detalle.venta_id
    INNER JOIN productos AS producto
      ON producto.id = detalle.producto_id
     AND COALESCE(producto.es_derivado, 0) = 1
  ),
  ultima_venta_hijo AS (
    SELECT
      tienda_id,
      producto_id,
      venta_id,
      venta_folio,
      venta_estado,
      fecha_venta
    FROM ventas_hijo_ordenadas
    WHERE posicion = 1
  ),
  ajustes_hijo AS (
    SELECT
      ajuste.tienda_id,
      ajuste.producto_id,
      COUNT(*) AS ajustes_conteo,
      COALESCE(SUM(CAST(ajuste.diferencia AS REAL)), 0) AS ajustes_diferencia,
      MAX(ajuste.fecha_ajuste) AS ultimo_ajuste_fecha
    FROM ajustes_inventario AS ajuste
    INNER JOIN productos AS producto
      ON producto.id = ajuste.producto_id
     AND COALESCE(producto.es_derivado, 0) = 1
    GROUP BY ajuste.tienda_id, ajuste.producto_id
  ),
  devoluciones_hijo AS (
    SELECT
      devolucion.tienda_id,
      detalle.producto_id,
      COUNT(DISTINCT devolucion.id) AS devoluciones_conteo,
      COUNT(*) AS devoluciones_renglones,
      COALESCE(SUM(CAST(detalle.cantidad AS REAL)), 0) AS devoluciones_cantidad,
      MAX(devolucion.fecha_devolucion) AS ultima_devolucion_fecha
    FROM devolucion_detalles AS detalle
    INNER JOIN devoluciones AS devolucion
      ON devolucion.id = detalle.devolucion_id
    INNER JOIN productos AS producto
      ON producto.id = detalle.producto_id
     AND COALESCE(producto.es_derivado, 0) = 1
    GROUP BY devolucion.tienda_id, detalle.producto_id
  )
  SELECT
    tienda.id AS tienda_id,
    tienda.nombre AS tienda,
    tienda.activa AS tienda_activa,

    par.producto_padre_id,
    par.producto_padre,
    par.producto_padre_activo,
    par.producto_derivado_id,
    par.producto_derivado,
    par.producto_derivado_activo,
    par.factor_conversion,

    COALESCE(inventario_padre.cantidad_actual, 0) AS stock_padre,
    COALESCE(inventario_hijo.cantidad_actual, 0) AS saldo_legacy_hijo,

    CASE
      WHEN par.producto_padre_id IS NULL
        OR par.producto_padre IS NULL
        OR par.factor_conversion IS NULL
        OR par.factor_conversion <= 0
        OR inventario_padre.filas_inventario IS NULL
      THEN NULL
      WHEN inventario_padre.cantidad_actual <= 0
      THEN 0
      ELSE CAST(
        (
          inventario_padre.cantidad_actual / par.factor_conversion
        ) + ${EPSILON_DISPONIBILIDAD}
        AS INTEGER
      )
    END AS disponibilidad_derivada_floor,

    CASE
      WHEN par.factor_conversion IS NULL OR par.factor_conversion <= 0
      THEN NULL
      ELSE ROUND(
        COALESCE(inventario_padre.cantidad_actual, 0)
          / par.factor_conversion,
        9
      )
    END AS disponibilidad_derivada_teorica,

    COALESCE(entrada.entradas_conteo, 0) AS entradas_hijo_conteo,
    COALESCE(entrada.entradas_renglones, 0) AS entradas_hijo_renglones,
    COALESCE(entrada.entradas_cantidad, 0) AS entradas_hijo_cantidad,
    entrada.ultima_entrada_fecha AS ultima_entrada_hijo_fecha,

    COALESCE(venta.ventas_conteo, 0) AS ventas_hijo_conteo,
    COALESCE(venta.ventas_renglones, 0) AS ventas_hijo_renglones,
    COALESCE(venta.ventas_cantidad, 0) AS ventas_hijo_cantidad,
    ultima_venta.venta_id AS ultima_venta_hijo_id,
    ultima_venta.venta_folio AS ultima_venta_hijo_folio,
    ultima_venta.venta_estado AS ultima_venta_hijo_estado,
    ultima_venta.fecha_venta AS ultima_venta_hijo_fecha,

    COALESCE(ajuste.ajustes_conteo, 0) AS ajustes_hijo_conteo,
    COALESCE(ajuste.ajustes_diferencia, 0) AS ajustes_hijo_diferencia,
    ajuste.ultimo_ajuste_fecha AS ultimo_ajuste_hijo_fecha,

    COALESCE(devolucion.devoluciones_conteo, 0) AS devoluciones_hijo_conteo,
    COALESCE(devolucion.devoluciones_renglones, 0) AS devoluciones_hijo_renglones,
    COALESCE(devolucion.devoluciones_cantidad, 0) AS devoluciones_hijo_cantidad,
    devolucion.ultima_devolucion_fecha AS ultima_devolucion_hijo_fecha,

    COALESCE(inventario_padre.filas_inventario, 0) AS inventario_padre_filas,
    COALESCE(inventario_hijo.filas_inventario, 0) AS inventario_hijo_filas,
    CASE
      WHEN par.producto_padre_id IS NULL OR par.producto_padre IS NULL THEN 1
      WHEN par.factor_conversion IS NULL OR par.factor_conversion <= 0 THEN 1
      WHEN COALESCE(inventario_padre.filas_inventario, 0) <> 1 THEN 1
      WHEN COALESCE(inventario_hijo.filas_inventario, 0) > 1 THEN 1
      WHEN ABS(COALESCE(inventario_hijo.cantidad_actual, 0)) > 0.000000001 THEN 1
      WHEN COALESCE(entrada.entradas_conteo, 0) > 0 THEN 1
      WHEN COALESCE(ajuste.ajustes_conteo, 0) > 0 THEN 1
      WHEN COALESCE(devolucion.devoluciones_conteo, 0) > 0 THEN 1
      WHEN COALESCE(venta.ventas_conteo, 0) > 0 THEN 1
      ELSE 0
    END AS requiere_revision
  FROM pares_derivados AS par
  CROSS JOIN tiendas AS tienda
  LEFT JOIN inventario_agrupado AS inventario_padre
    ON inventario_padre.tienda_id = tienda.id
   AND inventario_padre.producto_id = par.producto_padre_id
  LEFT JOIN inventario_agrupado AS inventario_hijo
    ON inventario_hijo.tienda_id = tienda.id
   AND inventario_hijo.producto_id = par.producto_derivado_id
  LEFT JOIN entradas_hijo AS entrada
    ON entrada.tienda_id = tienda.id
   AND entrada.producto_id = par.producto_derivado_id
  LEFT JOIN ventas_hijo AS venta
    ON venta.tienda_id = tienda.id
   AND venta.producto_id = par.producto_derivado_id
  LEFT JOIN ultima_venta_hijo AS ultima_venta
    ON ultima_venta.tienda_id = tienda.id
   AND ultima_venta.producto_id = par.producto_derivado_id
  LEFT JOIN ajustes_hijo AS ajuste
    ON ajuste.tienda_id = tienda.id
   AND ajuste.producto_id = par.producto_derivado_id
  LEFT JOIN devoluciones_hijo AS devolucion
    ON devolucion.tienda_id = tienda.id
   AND devolucion.producto_id = par.producto_derivado_id
  ORDER BY
    par.producto_padre COLLATE NOCASE,
    par.producto_derivado COLLATE NOCASE,
    tienda.id
`;

const USO = `Uso:
  node backend/src/reports/reporteInventarioDerivados.js --db <ruta.sqlite> [--format table|compact|json]

La ruta es obligatoria. El archivo se abre con sqlite3.OPEN_READONLY y la
conexion activa PRAGMA query_only=ON antes de ejecutar el reporte.`;

function validarRutaBase(rutaBase) {
  if (typeof rutaBase !== "string" || !rutaBase.trim()) {
    throw new Error("Debes proporcionar una ruta SQLite explicita con --db.");
  }

  const rutaAbsoluta = path.resolve(rutaBase.trim());
  let estadisticas;

  try {
    estadisticas = fs.statSync(rutaAbsoluta);
  } catch (error) {
    throw new Error(`No se puede acceder a la base indicada: ${rutaAbsoluta}`);
  }

  if (!estadisticas.isFile()) {
    throw new Error(`La ruta indicada no es un archivo: ${rutaAbsoluta}`);
  }

  return fs.realpathSync(rutaAbsoluta);
}

function abrirBaseSoloLectura(rutaBase, driver = sqlite3) {
  return new Promise((resolve, reject) => {
    const db = new driver.Database(
      rutaBase,
      driver.OPEN_READONLY,
      (error) => {
        if (error) {
          reject(
            new Error(
              `No se pudo abrir SQLite en modo READ_ONLY: ${error.message}`
            )
          );
          return;
        }

        resolve(db);
      }
    );
  });
}

function ejecutar(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function obtenerUno(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, [], (error, fila) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(fila);
    });
  });
}

function obtenerTodos(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (error, filas) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(filas);
    });
  });
}

function cerrarBase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function activarModoSoloLectura(db) {
  await ejecutar(db, "PRAGMA query_only = ON");
  const estado = await obtenerUno(db, "PRAGMA query_only");
  const valor = estado
    ? estado.query_only ?? Object.values(estado)[0]
    : undefined;

  if (Number(valor) !== 1) {
    throw new Error("SQLite no confirmo PRAGMA query_only=ON.");
  }
}

async function obtenerReporteInventarioDerivados(db) {
  await activarModoSoloLectura(db);
  return obtenerTodos(db, CONSULTA_REPORTE_INVENTARIO_DERIVADOS);
}

async function generarReporteInventarioDerivados(
  rutaBase,
  { driver = sqlite3 } = {}
) {
  const rutaValidada = validarRutaBase(rutaBase);
  const db = await abrirBaseSoloLectura(rutaValidada, driver);

  try {
    return await obtenerReporteInventarioDerivados(db);
  } finally {
    await cerrarBase(db);
  }
}

function parsearArgumentos(argumentos) {
  if (!Array.isArray(argumentos)) {
    throw new TypeError("Los argumentos del CLI deben ser un arreglo.");
  }

  if (argumentos.includes("--help") || argumentos.includes("-h")) {
    return { ayuda: true, rutaBase: null, formato: "table" };
  }

  let rutaBase = null;
  let formato = "table";

  for (let indice = 0; indice < argumentos.length; indice += 1) {
    const argumento = argumentos[indice];

    if (argumento === "--db") {
      rutaBase = argumentos[indice + 1];
      indice += 1;
      continue;
    }

    if (argumento.startsWith("--db=")) {
      rutaBase = argumento.slice("--db=".length);
      continue;
    }

    if (argumento === "--format") {
      formato = argumentos[indice + 1];
      indice += 1;
      continue;
    }

    if (argumento.startsWith("--format=")) {
      formato = argumento.slice("--format=".length);
      continue;
    }

    if (argumento === "--json") {
      formato = "json";
      continue;
    }

    if (argumento === "--table") {
      formato = "table";
      continue;
    }

    if (!argumento.startsWith("-") && !rutaBase) {
      rutaBase = argumento;
      continue;
    }

    throw new Error(`Argumento no reconocido: ${argumento}`);
  }

  if (!rutaBase) {
    throw new Error("Debes proporcionar una ruta SQLite explicita con --db.");
  }

  if (!new Set(["table", "compact", "json"]).has(formato)) {
    throw new Error(`Formato no soportado: ${formato}`);
  }

  return { ayuda: false, rutaBase, formato };
}

function convertirCelda(valor) {
  if (valor === null || valor === undefined) {
    return "NULL";
  }

  return String(valor).replace(/\s+/g, " ").trim();
}

function formatearTabla(filas) {
  if (!Array.isArray(filas) || filas.length === 0) {
    return "(sin filas)";
  }

  const columnas = Object.keys(filas[0]);
  const datos = filas.map((fila) =>
    columnas.map((columna) => convertirCelda(fila[columna]))
  );
  const anchos = columnas.map((columna, indice) =>
    Math.max(
      columna.length,
      ...datos.map((fila) => fila[indice].length)
    )
  );

  const separador = `+-${anchos.map((ancho) => "-".repeat(ancho)).join("-+-")}-+`;
  const crearFila = (valores) =>
    `| ${valores
      .map((valor, indice) => valor.padEnd(anchos[indice], " "))
      .join(" | ")} |`;

  return [
    separador,
    crearFila(columnas),
    separador,
    ...datos.map(crearFila),
    separador,
  ].join("\n");
}

function resumirFilas(filas) {
  return filas.map((fila) => ({
    tienda: fila.tienda,
    producto_padre: fila.producto_padre,
    producto_derivado: fila.producto_derivado,
    factor: fila.factor_conversion,
    stock_padre: fila.stock_padre,
    saldo_legacy_hijo: fila.saldo_legacy_hijo,
    disponibilidad: fila.disponibilidad_derivada_floor,
    entradas_hijo: fila.entradas_hijo_cantidad,
    ultima_venta: fila.ultima_venta_hijo_fecha,
    revision: fila.requiere_revision,
  }));
}

async function main(argumentos = process.argv.slice(2), salida = console) {
  const opciones = parsearArgumentos(argumentos);

  if (opciones.ayuda) {
    salida.log(USO);
    return [];
  }

  const filas = await generarReporteInventarioDerivados(opciones.rutaBase);
  const contenido = opciones.formato === "json"
    ? JSON.stringify(filas, null, 2)
    : formatearTabla(
        opciones.formato === "compact" ? resumirFilas(filas) : filas
      );

  salida.log(contenido);
  return filas;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONSULTA_REPORTE_INVENTARIO_DERIVADOS,
  USO,
  validarRutaBase,
  abrirBaseSoloLectura,
  activarModoSoloLectura,
  obtenerReporteInventarioDerivados,
  generarReporteInventarioDerivados,
  parsearArgumentos,
  formatearTabla,
  resumirFilas,
  main,
};
