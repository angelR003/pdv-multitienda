"use strict";

const assert = require("node:assert/strict");
const {
  after,
  before,
  beforeEach,
  test,
} = require("node:test");
const sqlite3 = require("sqlite3").verbose();

const TIENDA_ORIGEN = 1;
const TIENDA_DESTINO = 2;
const USUARIO_ADMIN = 1;
const PRODUCTO_PADRE = 100;
const PRODUCTO_DERIVADO = 101;
const PRODUCTO_NORMAL = 102;

const DDL = `
  CREATE TABLE tiendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ubicacion TEXT,
    activa INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL,
    tienda_id INTEGER,
    activo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_producto TEXT NOT NULL,
    codigo_barras TEXT UNIQUE,
    nombre TEXT NOT NULL,
    categoria TEXT,
    marca TEXT,
    presentacion TEXT,
    unidad TEXT NOT NULL,
    precio_global REAL NOT NULL,
    costo_compra REAL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    requiere_caducidad INTEGER NOT NULL DEFAULT 0,
    es_derivado INTEGER NOT NULL DEFAULT 0,
    producto_padre_id INTEGER,
    factor_conversion REAL NOT NULL DEFAULT 1,
    es_retornable INTEGER NOT NULL DEFAULT 0,
    tipo_envase_id INTEGER,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE precios_tienda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    tienda_id INTEGER NOT NULL,
    precio_especial REAL NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad_actual REAL NOT NULL DEFAULT 0,
    cantidad_minima REAL DEFAULT 0,
    cantidad_maxima REAL DEFAULT 0,
    ultima_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tienda_id, producto_id)
  );

  CREATE TABLE promociones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    cantidad_requerida INTEGER NOT NULL,
    precio_promocion REAL NOT NULL,
    activa INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT NOT NULL UNIQUE,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'completada',
    fecha_venta TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE venta_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    codigo_barras TEXT,
    nombre_producto TEXT NOT NULL,
    tipo_producto TEXT NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    promocion_id INTEGER,
    precio_unitario_original REAL,
    precio_unitario_final REAL,
    cantidad_promocion_aplicada INTEGER DEFAULT 0,
    descuento_promocion REAL DEFAULT 0
  );

  CREATE TABLE venta_servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    monto_base REAL NOT NULL,
    comision REAL NOT NULL DEFAULT 0,
    total_cobrado REAL NOT NULL,
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE entradas_mercancia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    proveedor TEXT,
    observaciones TEXT,
    fecha_entrada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE entrada_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrada_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad REAL NOT NULL,
    costo_unitario REAL DEFAULT 0
  );

  CREATE TABLE ajustes_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad_anterior REAL NOT NULL,
    cantidad_nueva REAL NOT NULL,
    diferencia REAL NOT NULL,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    fecha_ajuste TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE devoluciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    fecha_devolucion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_devuelto REAL DEFAULT 0
  );

  CREATE TABLE devolucion_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    devolucion_id INTEGER NOT NULL,
    producto_id INTEGER,
    servicio_id INTEGER,
    cantidad REAL NOT NULL,
    estado_producto TEXT NOT NULL,
    monto_devuelto REAL DEFAULT 0
  );

  CREATE TABLE importes_envases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    cliente TEXT NOT NULL,
    tipo_envase_id INTEGER NOT NULL,
    escenario TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    cantidad_pendiente INTEGER NOT NULL,
    importe_unitario REAL NOT NULL,
    importe_total REAL NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    cliente_fiado_id INTEGER
  );

  CREATE TABLE movimientos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo_movimiento TEXT NOT NULL,
    monto REAL NOT NULL,
    concepto TEXT NOT NULL,
    observaciones TEXT,
    fecha_movimiento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE clientes_fiado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT NOT NULL,
    apodo TEXT,
    telefono TEXT,
    limite_credito REAL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE fiados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tienda_id INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    monto REAL NOT NULL,
    fecha_fiado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE abonos_fiado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tienda_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    observaciones TEXT,
    fecha_abono TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE operaciones_abono_fiado (
    operation_id TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    cliente_id INTEGER NOT NULL,
    abono_id INTEGER NOT NULL UNIQUE,
    movimiento_caja_id INTEGER NOT NULL UNIQUE,
    respuesta_json TEXT NOT NULL,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE traspasos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_origen_id INTEGER NOT NULL,
    tienda_destino_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    motivo TEXT,
    estado TEXT NOT NULL DEFAULT 'enviado',
    fecha_envio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_recepcion TEXT
  );

  CREATE TABLE traspaso_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    traspaso_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad REAL NOT NULL
  );
`;

const REINICIAR_FIXTURES = `
  BEGIN;
  DELETE FROM devolucion_detalles;
  DELETE FROM devoluciones;
  DELETE FROM traspaso_detalles;
  DELETE FROM traspasos;
  DELETE FROM ajustes_inventario;
  DELETE FROM entrada_detalles;
  DELETE FROM entradas_mercancia;
  DELETE FROM movimientos_caja;
  DELETE FROM operaciones_abono_fiado;
  DELETE FROM abonos_fiado;
  DELETE FROM fiados;
  DELETE FROM clientes_fiado;
  DELETE FROM importes_envases;
  DELETE FROM venta_servicios;
  DELETE FROM venta_detalles;
  DELETE FROM ventas;
  DELETE FROM promociones;
  DELETE FROM precios_tienda;
  DELETE FROM inventario;
  DELETE FROM productos;
  DELETE FROM usuarios;
  DELETE FROM tiendas;
  DELETE FROM sqlite_sequence;

  INSERT INTO tiendas (id, nombre, ubicacion, activa) VALUES
    (1, 'Origen', 'Origen', 1),
    (2, 'Destino', 'Destino', 1);

  INSERT INTO usuarios (
    id, nombre, username, password_hash, rol, tienda_id, activo
  ) VALUES (
    1, 'Admin de prueba', 'admin-test', 'sin-uso', 'administrador', 1, 1
  );

  INSERT INTO productos (
    id, tipo_producto, codigo_barras, nombre, presentacion, unidad,
    precio_global, activo, es_derivado, producto_padre_id,
    factor_conversion, es_retornable
  ) VALUES
    (100, 'codigo_barras', 'PADRE-100', 'Caja padre', 'caja', 'caja',
      100, 1, 0, NULL, 1, 0),
    (101, 'codigo_barras', 'HIJO-101', 'Pieza derivada', 'pieza', 'pieza',
      5, 1, 1, 100, 0.25, 0),
    (102, 'codigo_barras', 'NORMAL-102', 'Producto normal', 'pieza', 'pieza',
      10, 1, 0, NULL, 1, 0);

  INSERT INTO inventario (
    tienda_id, producto_id, cantidad_actual, cantidad_minima, cantidad_maxima
  ) VALUES
    (1, 100, 10, 0, 100),
    (1, 101, 7, 0, 100),
    (1, 102, 10, 0, 100),
    (2, 100, 2, 0, 100),
    (2, 101, 4, 0, 100),
    (2, 102, 0, 0, 100);

  INSERT INTO clientes_fiado (
    id, nombre_completo, limite_credito, activo
  ) VALUES (1, 'Cliente de prueba', 500, 1);

  INSERT INTO fiados (
    cliente_id, usuario_id, tienda_id, concepto, monto
  ) VALUES (1, 1, 1, 'Compra inicial', 100);
  COMMIT;
`;

let db;
let rutaModuloConexion;
let crearVenta;
let registrarEntrada;
let registrarAjusteInventario;
let registrarDevolucionRenglon;
let registrarDevolucion;
let crearTraspaso;
let recibirTraspaso;
let cancelarTraspaso;
let actualizarProducto;
let calcularDisponibilidadComercial;
let derivarEstadoCuenta;
let agregarEstadoCuenta;
let registrarAbono;

function abrirBaseEnMemoria() {
  return new Promise((resolve, reject) => {
    const conexion = new sqlite3.Database(":memory:", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(conexion);
    });
  });
}

function ejecutarScript(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function ejecutar(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, parametros, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function obtenerUno(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, parametros, (error, fila) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(fila);
    });
  });
}

function cerrarBase() {
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

function invocarControlador(
  controlador,
  {
    body = {},
    params = {},
    query = {},
    usuario = {
      id: USUARIO_ADMIN,
      rol: "administrador",
      tienda_id: TIENDA_ORIGEN,
    },
  } = {}
) {
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const temporizador = setTimeout(() => {
      if (!finalizado) {
        finalizado = true;
        reject(new Error("El controlador no produjo respuesta en 5 segundos"));
      }
    }, 5000);

    const terminar = (resultado) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      resolve(resultado);
    };

    const res = {
      statusCode: 200,
      status(codigo) {
        this.statusCode = codigo;
        return this;
      },
      json(contenido) {
        terminar({ status: this.statusCode, body: contenido });
        return this;
      },
    };

    try {
      const resultado = controlador(
        { body, params, query, usuario },
        res
      );

      if (resultado && typeof resultado.then === "function") {
        resultado.catch((error) => {
          if (finalizado) return;
          finalizado = true;
          clearTimeout(temporizador);
          reject(error);
        });
      }
    } catch (error) {
      clearTimeout(temporizador);
      reject(error);
    }
  });
}

function ventaEfectivo(productoId, cantidad) {
  return invocarControlador(crearVenta, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      metodo_pago: "efectivo",
      productos: [{ producto_id: productoId, cantidad }],
      envases: [],
      servicios: [],
    },
  });
}

async function cantidadInventario(tiendaId, productoId) {
  const fila = await obtenerUno(
    `
      SELECT cantidad_actual
      FROM inventario
      WHERE tienda_id = ? AND producto_id = ?
    `,
    [tiendaId, productoId]
  );

  return Number(fila?.cantidad_actual);
}

async function contar(tabla) {
  const tablasPermitidas = new Set([
    "ajustes_inventario",
    "abonos_fiado",
    "devolucion_detalles",
    "devoluciones",
    "entrada_detalles",
    "entradas_mercancia",
    "movimientos_caja",
    "operaciones_abono_fiado",
    "traspaso_detalles",
    "traspasos",
    "venta_detalles",
    "ventas",
  ]);

  assert.ok(tablasPermitidas.has(tabla), `Tabla no permitida: ${tabla}`);
  const fila = await obtenerUno(`SELECT COUNT(*) AS total FROM ${tabla}`);
  return Number(fila.total);
}

function assertCasiIgual(actual, esperado, tolerancia = 1e-8) {
  assert.ok(
    Math.abs(Number(actual) - Number(esperado)) <= tolerancia,
    `Esperado ${esperado}, recibido ${actual}`
  );
}

async function crearTraspasoDerivado() {
  return invocarControlador(crearTraspaso, {
    body: {
      tienda_origen_id: TIENDA_ORIGEN,
      tienda_destino_id: TIENDA_DESTINO,
      motivo: "Prueba derivada",
      productos: [{ producto_id: PRODUCTO_DERIVADO, cantidad: 4 }],
    },
  });
}

function bodyProductoDerivado(sobrescrituras = {}) {
  return {
    tipo_producto: "codigo_barras",
    codigo_barras: "HIJO-101",
    nombre: "Pieza derivada",
    categoria: null,
    marca: null,
    presentacion: "pieza",
    unidad: "pieza",
    precio_global: 5,
    costo_compra: 0,
    requiere_caducidad: 0,
    es_derivado: 1,
    producto_padre_id: PRODUCTO_PADRE,
    factor_conversion: 0.25,
    es_retornable: 0,
    tipo_envase_id: null,
    ...sobrescrituras,
  };
}

function devolverVentaCompleta(ventaId, bodyExtra = {}) {
  return invocarControlador(registrarDevolucion, {
    body: {
      venta_id: ventaId,
      motivo: "Devolucion total de prueba",
      ...bodyExtra,
    },
  });
}

function crearTraspasoNormal(cantidad = 3) {
  return invocarControlador(crearTraspaso, {
    body: {
      tienda_origen_id: TIENDA_ORIGEN,
      tienda_destino_id: TIENDA_DESTINO,
      motivo: "Prueba normal",
      productos: [{ producto_id: PRODUCTO_NORMAL, cantidad }],
    },
  });
}

before(async () => {
  db = await abrirBaseEnMemoria();
  await ejecutarScript(DDL);

  rutaModuloConexion = require.resolve("../src/database/connection");
  assert.equal(
    require.cache[rutaModuloConexion],
    undefined,
    "La conexion real se cargo antes de poder inyectar la base desechable"
  );

  require.cache[rutaModuloConexion] = {
    id: rutaModuloConexion,
    filename: rutaModuloConexion,
    loaded: true,
    exports: db,
    children: [],
    paths: [],
  };

  ({ crearVenta } = require("../src/controllers/ventas.controller"));
  ({ registrarEntrada } = require("../src/controllers/entradas.controller"));
  ({ registrarAjusteInventario } = require(
    "../src/controllers/ajustesInventario.controller"
  ));
  ({ registrarDevolucion, registrarDevolucionRenglon } = require(
    "../src/controllers/devoluciones.controller"
  ));
  ({ crearTraspaso, recibirTraspaso, cancelarTraspaso } = require(
    "../src/controllers/traspasos.controller"
  ));
  ({ actualizarProducto } = require("../src/controllers/productos.controller"));
  ({ registrarAbono } = require("../src/controllers/fiados.controller"));
  ({ calcularDisponibilidadComercial } = require(
    "../src/services/inventarioFisico.service"
  ));
  ({ derivarEstadoCuenta, agregarEstadoCuenta } = require(
    "../src/services/cuentaCliente.service"
  ));
});

beforeEach(async () => {
  await ejecutarScript(REINICIAR_FIXTURES);
});

after(async () => {
  if (db) {
    await cerrarBase();
  }

  if (rutaModuloConexion) {
    delete require.cache[rutaModuloConexion];
  }
});

test("venta normal conserva la semantica de inventario directo", { concurrency: false }, async () => {
  const respuesta = await ventaEfectivo(PRODUCTO_NORMAL, 2);

  assert.equal(respuesta.status, 201);
  assert.equal(await contar("ventas"), 1);
  assert.equal(await contar("venta_detalles"), 1);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL),
    8
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );

  const detalle = await obtenerUno("SELECT * FROM venta_detalles LIMIT 1");
  assert.equal(detalle.producto_id, PRODUCTO_NORMAL);
  assert.equal(detalle.cantidad, 2);
});

test("venta derivada conserva el hijo en detalle y descuenta solo al padre", { concurrency: false }, async () => {
  const respuesta = await ventaEfectivo(PRODUCTO_DERIVADO, 4);

  assert.equal(respuesta.status, 201);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    9
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );

  const detalle = await obtenerUno("SELECT * FROM venta_detalles LIMIT 1");
  assert.equal(detalle.producto_id, PRODUCTO_DERIVADO);
  assert.equal(detalle.cantidad, 4);
});

test("venta derivada rechaza inventario insuficiente del padre sin efectos parciales", { concurrency: false }, async () => {
  await ejecutar(
    "UPDATE inventario SET cantidad_actual = 0.9 WHERE tienda_id = ? AND producto_id = ?",
    [TIENDA_ORIGEN, PRODUCTO_PADRE]
  );

  const respuesta = await ventaEfectivo(PRODUCTO_DERIVADO, 4);

  assert.equal(respuesta.status, 400);
  assert.match(respuesta.body.error, /inventario insuficiente/i);
  assert.equal(await contar("ventas"), 0);
  assert.equal(await contar("venta_detalles"), 0);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    0.9
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
});

async function comprobarFactorDerivado(factor, cantidadComercial) {
  await ejecutar(
    "UPDATE productos SET factor_conversion = ? WHERE id = ?",
    [factor, PRODUCTO_DERIVADO]
  );
  await ejecutar(
    "UPDATE inventario SET cantidad_actual = 1 WHERE tienda_id = ? AND producto_id = ?",
    [TIENDA_ORIGEN, PRODUCTO_PADRE]
  );

  assert.equal(
    calcularDisponibilidadComercial(1, factor),
    cantidadComercial
  );

  const respuesta = await ventaEfectivo(
    PRODUCTO_DERIVADO,
    cantidadComercial
  );

  assert.equal(respuesta.status, 201);
  assertCasiIgual(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    0
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );

  const detalle = await obtenerUno("SELECT * FROM venta_detalles LIMIT 1");
  assert.equal(detalle.producto_id, PRODUCTO_DERIVADO);
  assert.equal(detalle.cantidad, cantidadComercial);
}

test("factor 0.025 permite exactamente 40 unidades derivadas", { concurrency: false }, async () => {
  await comprobarFactorDerivado(0.025, 40);
});

test("factor 0.0833333333 no pierde la duodecima unidad por ruido flotante", { concurrency: false }, async () => {
  await comprobarFactorDerivado(0.0833333333, 12);
});

test("padre y factor quedan inmutables cuando el derivado ya tiene historia", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_DERIVADO, 1);
  assert.equal(venta.status, 201);

  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: {
      tipo_producto: "codigo_barras",
      codigo_barras: "HIJO-101",
      nombre: "Pieza derivada",
      categoria: null,
      marca: null,
      presentacion: "pieza",
      unidad: "pieza",
      precio_global: 5,
      costo_compra: 0,
      requiere_caducidad: 0,
      es_derivado: 1,
      producto_padre_id: PRODUCTO_PADRE,
      factor_conversion: 0.2,
      actualizar_relacion_derivada: true,
      es_retornable: 0,
      tipo_envase_id: null,
    },
  });

  assert.equal(respuesta.status, 409);
  assert.match(respuesta.body.error, /historial/i);

  const producto = await obtenerUno(
    "SELECT producto_padre_id, factor_conversion FROM productos WHERE id = ?",
    [PRODUCTO_DERIVADO]
  );
  assert.equal(producto.producto_padre_id, PRODUCTO_PADRE);
  assert.equal(producto.factor_conversion, 0.25);
});

test("entrada derivada se rechaza y no crea cabecera, detalle ni mutacion", { concurrency: false }, async () => {
  const respuesta = await invocarControlador(registrarEntrada, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      proveedor: "Proveedor de prueba",
      producto_id: PRODUCTO_DERIVADO,
      cantidad: 4,
      costo_unitario: 1,
      observaciones: "No debe persistir",
    },
  });

  assert.equal(respuesta.status, 400);
  assert.match(respuesta.body.error, /producto padre/i);
  assert.equal(await contar("entradas_mercancia"), 0);
  assert.equal(await contar("entrada_detalles"), 0);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
});

test("entrada normal conserva el flujo y suma su propia fila fisica", { concurrency: false }, async () => {
  const respuesta = await invocarControlador(registrarEntrada, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      proveedor: "Proveedor de prueba",
      producto_id: PRODUCTO_NORMAL,
      cantidad: 3,
      costo_unitario: 2,
      observaciones: "Entrada normal",
    },
  });

  assert.equal(respuesta.status, 201);
  assert.equal(await contar("entradas_mercancia"), 1);
  assert.equal(await contar("entrada_detalles"), 1);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL),
    13
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
});

test("ajuste derivado se rechaza y no modifica padre, hijo ni historial", { concurrency: false }, async () => {
  const respuesta = await invocarControlador(registrarAjusteInventario, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      producto_id: PRODUCTO_DERIVADO,
      cantidad_nueva: 20,
      motivo: "Conteo de prueba",
      observaciones: "No debe persistir",
    },
  });

  assert.equal(respuesta.status, 400);
  assert.match(respuesta.body.error, /producto padre/i);
  assert.equal(await contar("ajustes_inventario"), 0);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
});

test("ajuste normal conserva auditoria y establece su propia fila fisica", { concurrency: false }, async () => {
  const respuesta = await invocarControlador(registrarAjusteInventario, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      producto_id: PRODUCTO_NORMAL,
      cantidad_nueva: 7,
      motivo: "Conteo normal",
      observaciones: "Ajuste permitido",
    },
  });

  assert.equal(respuesta.status, 201);
  assert.equal(await contar("ajustes_inventario"), 1);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL),
    7
  );

  const ajuste = await obtenerUno("SELECT * FROM ajustes_inventario LIMIT 1");
  assert.equal(ajuste.producto_id, PRODUCTO_NORMAL);
  assert.equal(ajuste.cantidad_anterior, 10);
  assert.equal(ajuste.cantidad_nueva, 7);
});

test("devolucion por renglon derivado restaura el padre y conserva el hijo", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_DERIVADO, 4);
  assert.equal(venta.status, 201);

  const detalleVenta = await obtenerUno(
    "SELECT * FROM venta_detalles WHERE venta_id = ?",
    [venta.body.venta_id]
  );

  const respuesta = await invocarControlador(registrarDevolucionRenglon, {
    body: {
      venta_id: venta.body.venta_id,
      venta_detalle_id: detalleVenta.id,
      producto_id: PRODUCTO_DERIVADO,
      detalle_tipo: "producto",
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      cantidad: 4,
      precio_unitario: detalleVenta.precio_unitario,
      motivo: "Devolucion de prueba",
    },
  });

  assert.equal(respuesta.status, 201);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );

  const detalleDevolucion = await obtenerUno(
    "SELECT * FROM devolucion_detalles LIMIT 1"
  );
  assert.equal(detalleDevolucion.producto_id, PRODUCTO_DERIVADO);
  assert.equal(detalleDevolucion.cantidad, 4);

  const ventaActualizada = await obtenerUno(
    "SELECT estado FROM ventas WHERE id = ?",
    [venta.body.venta_id]
  );
  assert.equal(ventaActualizada.estado, "devuelta_total");
});

test("devolucion total derivada restaura el padre y nunca incrementa el hijo", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_DERIVADO, 4);
  assert.equal(venta.status, 201);

  const respuesta = await invocarControlador(registrarDevolucion, {
    body: {
      venta_id: venta.body.venta_id,
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      motivo: "Devolucion total de prueba",
    },
  });

  assert.equal(respuesta.status, 201);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
  assert.equal(await contar("devoluciones"), 1);

  const ventaActualizada = await obtenerUno(
    "SELECT estado FROM ventas WHERE id = ?",
    [venta.body.venta_id]
  );
  assert.equal(ventaActualizada.estado, "devuelta_total");
});

test("traspaso derivado recibido conserva hijo en detalle y mueve padre", { concurrency: false }, async () => {
  const creado = await crearTraspasoDerivado();

  assert.equal(creado.status, 201);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    9
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );

  const detalle = await obtenerUno(
    "SELECT * FROM traspaso_detalles WHERE traspaso_id = ?",
    [creado.body.traspaso_id]
  );
  assert.equal(detalle.producto_id, PRODUCTO_DERIVADO);
  assert.equal(detalle.cantidad, 4);

  const recibido = await invocarControlador(recibirTraspaso, {
    params: { id: creado.body.traspaso_id },
    usuario: {
      id: USUARIO_ADMIN,
      rol: "administrador",
      tienda_id: TIENDA_DESTINO,
    },
  });

  assert.equal(recibido.status, 200);
  assert.equal(
    await cantidadInventario(TIENDA_DESTINO, PRODUCTO_PADRE),
    3
  );
  assert.equal(
    await cantidadInventario(TIENDA_DESTINO, PRODUCTO_DERIVADO),
    4
  );

  const traspaso = await obtenerUno(
    "SELECT estado FROM traspasos WHERE id = ?",
    [creado.body.traspaso_id]
  );
  assert.equal(traspaso.estado, "recibido");
});

test("cancelar traspaso derivado restaura solo el padre de origen", { concurrency: false }, async () => {
  const creado = await crearTraspasoDerivado();
  assert.equal(creado.status, 201);

  const cancelado = await invocarControlador(cancelarTraspaso, {
    params: { id: creado.body.traspaso_id },
  });

  assert.equal(cancelado.status, 200);
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_PADRE),
    10
  );
  assert.equal(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_DERIVADO),
    7
  );
  assert.equal(
    await cantidadInventario(TIENDA_DESTINO, PRODUCTO_PADRE),
    2
  );

  const traspaso = await obtenerUno(
    "SELECT estado FROM traspasos WHERE id = ?",
    [creado.body.traspaso_id]
  );
  assert.equal(traspaso.estado, "cancelado");
});

test("saldo puro distingue credito 107 contra fiados de 50 y 150", { concurrency: false }, () => {
  assert.deepEqual(derivarEstadoCuenta(0), {
    saldo_neto: 0,
    saldo_deudor: 0,
    saldo_a_favor: 0,
    estado_cuenta: "saldado",
  });

  assert.deepEqual(derivarEstadoCuenta(50 - 107), {
    saldo_neto: -57,
    saldo_deudor: 0,
    saldo_a_favor: 57,
    estado_cuenta: "a_favor",
  });

  assert.deepEqual(derivarEstadoCuenta(150 - 107), {
    saldo_neto: 43,
    saldo_deudor: 43,
    saldo_a_favor: 0,
    estado_cuenta: "debe",
  });
});

test("la agregacion conserva deudores y saldos a favor separados por cliente", { concurrency: false }, () => {
  const clientes = [
    { id: 1, nombre: "Cliente a favor", saldo_neto: 50 - 107 },
    { id: 2, nombre: "Cliente deudor", saldo_neto: 150 - 107 },
  ].map(agregarEstadoCuenta);

  const cuentasPorCobrar = clientes.filter(
    (cliente) => cliente.saldo_deudor > 0
  );
  const saldosAFavor = clientes.filter(
    (cliente) => cliente.saldo_a_favor > 0
  );

  assert.deepEqual(cuentasPorCobrar.map((cliente) => cliente.id), [2]);
  assert.deepEqual(saldosAFavor.map((cliente) => cliente.id), [1]);
  assert.equal(
    cuentasPorCobrar.reduce(
      (total, cliente) => total + cliente.saldo_deudor,
      0
    ),
    43
  );
  assert.equal(
    saldosAFavor.reduce(
      (total, cliente) => total + cliente.saldo_a_favor,
      0
    ),
    57
  );
  assert.equal(
    clientes.reduce((total, cliente) => total + cliente.saldo_neto, 0),
    -14
  );
});

test("sobreabono informa el credito antes de confirmar y registra abono/caja atomicamente", { concurrency: false }, async () => {
  const body = {
    cliente_id: 1,
    usuario_id: USUARIO_ADMIN,
    tienda_id: TIENDA_ORIGEN,
    monto: 150,
    observaciones: "Sobreabono de prueba",
    operation_id: "abono-prueba-0001",
  };

  const previa = await invocarControlador(registrarAbono, { body });

  assert.equal(previa.status, 409);
  assert.equal(
    previa.body.codigo,
    "CONFIRMACION_SALDO_A_FAVOR_REQUERIDA"
  );
  assert.equal(previa.body.saldo_resultante.saldo_a_favor, 50);
  assert.equal(previa.body.saldo_resultante.estado_cuenta, "a_favor");
  assert.equal(await contar("abonos_fiado"), 0);
  assert.equal(await contar("movimientos_caja"), 0);

  const confirmada = await invocarControlador(registrarAbono, {
    body: { ...body, confirmar_saldo_a_favor: true },
  });

  assert.equal(confirmada.status, 200);
  assert.equal(confirmada.body.saldo_neto, -50);
  assert.equal(confirmada.body.saldo_a_favor, 50);
  assert.equal(confirmada.body.estado_cuenta, "a_favor");
  assert.equal(await contar("abonos_fiado"), 1);
  assert.equal(await contar("movimientos_caja"), 1);
  assert.equal(await contar("operaciones_abono_fiado"), 1);
});

test("derivado historico con factor 0.0833333333 permite editar solo precio", { concurrency: false }, async () => {
  await ejecutar("UPDATE productos SET factor_conversion = ? WHERE id = ?", [
    0.0833333333,
    PRODUCTO_DERIVADO,
  ]);
  assert.equal((await ventaEfectivo(PRODUCTO_DERIVADO, 1)).status, 201);

  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: bodyProductoDerivado({
      precio_global: 6,
      factor_conversion: 1 / 12,
      actualizar_relacion_derivada: false,
    }),
  });

  assert.equal(respuesta.status, 200);
  const producto = await obtenerUno(
    "SELECT precio_global, factor_conversion FROM productos WHERE id = ?",
    [PRODUCTO_DERIVADO]
  );
  assert.equal(producto.precio_global, 6);
  assert.equal(producto.factor_conversion, 0.0833333333);
});

test("derivado historico permite editar solo nombre", { concurrency: false }, async () => {
  assert.equal((await ventaEfectivo(PRODUCTO_DERIVADO, 1)).status, 201);
  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: bodyProductoDerivado({
      nombre: "Pieza derivada renombrada",
      actualizar_relacion_derivada: false,
    }),
  });

  assert.equal(respuesta.status, 200);
  const producto = await obtenerUno("SELECT nombre FROM productos WHERE id = ?", [
    PRODUCTO_DERIVADO,
  ]);
  assert.equal(producto.nombre, "Pieza derivada renombrada");
});

test("padre desactivado no bloquea una edicion no estructural del hijo", { concurrency: false }, async () => {
  assert.equal((await ventaEfectivo(PRODUCTO_DERIVADO, 1)).status, 201);
  await ejecutar("UPDATE productos SET activo = 0 WHERE id = ?", [PRODUCTO_PADRE]);

  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: bodyProductoDerivado({
      marca: "Marca actualizada",
      actualizar_relacion_derivada: false,
    }),
  });

  assert.equal(respuesta.status, 200);
  const producto = await obtenerUno("SELECT marca FROM productos WHERE id = ?", [
    PRODUCTO_DERIVADO,
  ]);
  assert.equal(producto.marca, "Marca actualizada");
});

test("cambio real de factor con historial responde 409", { concurrency: false }, async () => {
  assert.equal((await ventaEfectivo(PRODUCTO_DERIVADO, 1)).status, 201);
  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: bodyProductoDerivado({
      factor_conversion: 0.2,
      actualizar_relacion_derivada: true,
    }),
  });

  assert.equal(respuesta.status, 409);
  assert.match(respuesta.body.error, /historial/i);
});

test("cambio real de padre con historial responde 409", { concurrency: false }, async () => {
  assert.equal((await ventaEfectivo(PRODUCTO_DERIVADO, 1)).status, 201);
  const respuesta = await invocarControlador(actualizarProducto, {
    params: { id: PRODUCTO_DERIVADO },
    body: bodyProductoDerivado({
      producto_padre_id: PRODUCTO_NORMAL,
      actualizar_relacion_derivada: true,
    }),
  });

  assert.equal(respuesta.status, 409);
  assert.match(respuesta.body.error, /historial/i);
});

test("ajuste normal conserva precision superior a tres decimales", { concurrency: false }, async () => {
  const cantidadExacta = 7.123456789;
  const respuesta = await invocarControlador(registrarAjusteInventario, {
    body: {
      tienda_id: TIENDA_ORIGEN,
      producto_id: PRODUCTO_NORMAL,
      cantidad_nueva: cantidadExacta,
      motivo: "Precision normal",
    },
  });

  assert.equal(respuesta.status, 201);
  assertCasiIgual(
    await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL),
    cantidadExacta,
    1e-12
  );
  const ajuste = await obtenerUno("SELECT cantidad_nueva FROM ajustes_inventario LIMIT 1");
  assertCasiIgual(ajuste.cantidad_nueva, cantidadExacta, 1e-12);
});

test("devolucion total normal restaura exactamente y crea detalles", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 2);
  const respuesta = await devolverVentaCompleta(venta.body.venta_id);

  assert.equal(respuesta.status, 201);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  assert.equal(await contar("devoluciones"), 1);
  assert.equal(await contar("devolucion_detalles"), 1);
  const detalle = await obtenerUno("SELECT * FROM devolucion_detalles LIMIT 1");
  assert.equal(detalle.producto_id, PRODUCTO_NORMAL);
  assert.equal(detalle.cantidad, 2);
});

test("devolucion parcial seguida de total restaura solo el remanente", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 4);
  const detalleVenta = await obtenerUno(
    "SELECT * FROM venta_detalles WHERE venta_id = ?",
    [venta.body.venta_id]
  );
  const parcial = await invocarControlador(registrarDevolucionRenglon, {
    body: {
      venta_id: venta.body.venta_id,
      venta_detalle_id: detalleVenta.id,
      producto_id: PRODUCTO_NORMAL,
      detalle_tipo: "producto",
      tienda_id: TIENDA_ORIGEN,
      usuario_id: USUARIO_ADMIN,
      cantidad: 1,
      precio_unitario: detalleVenta.precio_unitario,
      motivo: "Parcial previa",
    },
  });
  assert.equal(parcial.status, 201);

  const total = await devolverVentaCompleta(venta.body.venta_id);
  assert.equal(total.status, 201);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  const ultimoDetalle = await obtenerUno(
    "SELECT * FROM devolucion_detalles ORDER BY id DESC LIMIT 1"
  );
  assert.equal(ultimoDetalle.cantidad, 3);
});

test("repetir devolucion total no restaura inventario dos veces", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 2);
  assert.equal((await devolverVentaCompleta(venta.body.venta_id)).status, 201);
  const repetida = await devolverVentaCompleta(venta.body.venta_id);

  assert.equal(repetida.status, 409);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  assert.equal(await contar("devoluciones"), 1);
  assert.equal(await contar("devolucion_detalles"), 1);
});

test("devoluciones totales concurrentes restauran un solo remanente", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 2);
  const respuestas = await Promise.all([
    devolverVentaCompleta(venta.body.venta_id),
    devolverVentaCompleta(venta.body.venta_id),
  ]);

  assert.equal(respuestas.filter((item) => item.status === 201).length, 1);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  assert.equal(await contar("devoluciones"), 1);
  assert.equal(await contar("devolucion_detalles"), 1);
});

test("devolucion total ignora tienda manipulada en body", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 2);
  const respuesta = await devolverVentaCompleta(venta.body.venta_id, {
    tienda_id: TIENDA_DESTINO,
  });

  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.body.tienda_id, TIENDA_ORIGEN);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  assert.equal(await cantidadInventario(TIENDA_DESTINO, PRODUCTO_NORMAL), 0);
  const devolucion = await obtenerUno("SELECT tienda_id FROM devoluciones LIMIT 1");
  assert.equal(devolucion.tienda_id, TIENDA_ORIGEN);
});

test("fallo posterior a restaurar inventario revierte devolucion completa", { concurrency: false }, async () => {
  const venta = await ventaEfectivo(PRODUCTO_NORMAL, 2);
  await ejecutarScript(`
    CREATE TRIGGER fallar_estado_devolucion
    BEFORE UPDATE OF estado ON ventas
    WHEN NEW.estado = 'devuelta_total'
    BEGIN
      SELECT RAISE(ABORT, 'fallo simulado');
    END;
  `);

  try {
    const respuesta = await devolverVentaCompleta(venta.body.venta_id);
    assert.equal(respuesta.status, 500);
    assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 8);
    assert.equal(await contar("devoluciones"), 0);
    assert.equal(await contar("devolucion_detalles"), 0);
    const ventaActual = await obtenerUno("SELECT estado FROM ventas WHERE id = ?", [
      venta.body.venta_id,
    ]);
    assert.equal(ventaActual.estado, "completada");
  } finally {
    await ejecutar("DROP TRIGGER IF EXISTS fallar_estado_devolucion");
  }
});

test("mismo operation_id y payload devuelve resultado previo sin duplicar", { concurrency: false }, async () => {
  const body = {
    cliente_id: 1,
    usuario_id: USUARIO_ADMIN,
    tienda_id: TIENDA_ORIGEN,
    monto: 150,
    observaciones: "Idempotente",
    confirmar_saldo_a_favor: true,
    operation_id: "abono-idempotente-0001",
  };

  const primera = await invocarControlador(registrarAbono, { body });
  const repetida = await invocarControlador(registrarAbono, { body });

  assert.equal(primera.status, 200);
  assert.equal(repetida.status, 200);
  assert.equal(repetida.body.idempotente, true);
  assert.equal(repetida.body.id, primera.body.id);
  assert.equal(await contar("abonos_fiado"), 1);
  assert.equal(await contar("movimientos_caja"), 1);
  assert.equal(await contar("operaciones_abono_fiado"), 1);
});

test("mismo operation_id con monto distinto se rechaza", { concurrency: false }, async () => {
  const base = {
    cliente_id: 1,
    usuario_id: USUARIO_ADMIN,
    tienda_id: TIENDA_ORIGEN,
    monto: 50,
    observaciones: "Misma clave",
    operation_id: "abono-conflicto-0001",
  };
  assert.equal((await invocarControlador(registrarAbono, { body: base })).status, 200);

  const conflicto = await invocarControlador(registrarAbono, {
    body: { ...base, monto: 60 },
  });
  assert.equal(conflicto.status, 409);
  assert.equal(conflicto.body.codigo, "OPERATION_ID_REUTILIZADO");
  assert.equal(await contar("abonos_fiado"), 1);
  assert.equal(await contar("movimientos_caja"), 1);
});

test("reintento tras perdida de respuesta conserva una sola operacion", { concurrency: false }, async () => {
  const body = {
    cliente_id: 1,
    usuario_id: USUARIO_ADMIN,
    tienda_id: TIENDA_ORIGEN,
    monto: 40,
    observaciones: "Respuesta perdida",
    operation_id: "abono-respuesta-perdida-0001",
  };

  const respuestaPerdida = await invocarControlador(registrarAbono, { body });
  assert.equal(respuestaPerdida.status, 200);
  const reintento = await invocarControlador(registrarAbono, { body });

  assert.equal(reintento.status, 200);
  assert.equal(reintento.body.idempotente, true);
  assert.equal(await contar("abonos_fiado"), 1);
  assert.equal(await contar("movimientos_caja"), 1);
  assert.equal(await contar("operaciones_abono_fiado"), 1);
});

test("cancelar confirmacion de sobreabono deja cero escrituras", { concurrency: false }, async () => {
  const respuesta = await invocarControlador(registrarAbono, {
    body: {
      cliente_id: 1,
      usuario_id: USUARIO_ADMIN,
      tienda_id: TIENDA_ORIGEN,
      monto: 150,
      operation_id: "abono-cancelado-0001",
    },
  });

  assert.equal(respuesta.status, 409);
  assert.equal(respuesta.body.codigo, "CONFIRMACION_SALDO_A_FAVOR_REQUERIDA");
  assert.equal(await contar("abonos_fiado"), 0);
  assert.equal(await contar("movimientos_caja"), 0);
  assert.equal(await contar("operaciones_abono_fiado"), 0);
});

test("fallo al insertar caja revierte abono y operacion idempotente", { concurrency: false }, async () => {
  await ejecutarScript(`
    CREATE TRIGGER fallar_caja_abono
    BEFORE INSERT ON movimientos_caja
    WHEN NEW.concepto = 'Abono de fiado'
    BEGIN
      SELECT RAISE(ABORT, 'fallo de caja simulado');
    END;
  `);

  try {
    const respuesta = await invocarControlador(registrarAbono, {
      body: {
        cliente_id: 1,
        usuario_id: USUARIO_ADMIN,
        tienda_id: TIENDA_ORIGEN,
        monto: 50,
        operation_id: "abono-falla-caja-0001",
      },
    });

    assert.equal(respuesta.status, 500);
    assert.equal(await contar("abonos_fiado"), 0);
    assert.equal(await contar("movimientos_caja"), 0);
    assert.equal(await contar("operaciones_abono_fiado"), 0);
  } finally {
    await ejecutar("DROP TRIGGER IF EXISTS fallar_caja_abono");
  }
});

test("traspaso normal recibido mueve la misma unidad y segundo intento no duplica", { concurrency: false }, async () => {
  const creado = await crearTraspasoNormal(3);
  assert.equal(creado.status, 201);
  const primera = await invocarControlador(recibirTraspaso, {
    params: { id: creado.body.traspaso_id },
    usuario: { id: 1, rol: "administrador", tienda_id: TIENDA_DESTINO },
  });
  const segunda = await invocarControlador(recibirTraspaso, {
    params: { id: creado.body.traspaso_id },
    usuario: { id: 1, rol: "administrador", tienda_id: TIENDA_DESTINO },
  });

  assert.equal(primera.status, 200);
  assert.ok([400, 409].includes(segunda.status));
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 7);
  assert.equal(await cantidadInventario(TIENDA_DESTINO, PRODUCTO_NORMAL), 3);
});

test("cancelacion normal restaura una sola vez", { concurrency: false }, async () => {
  const creado = await crearTraspasoNormal(3);
  const primera = await invocarControlador(cancelarTraspaso, {
    params: { id: creado.body.traspaso_id },
  });
  const segunda = await invocarControlador(cancelarTraspaso, {
    params: { id: creado.body.traspaso_id },
  });

  assert.equal(primera.status, 200);
  assert.ok([400, 409].includes(segunda.status));
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
  assert.equal(await cantidadInventario(TIENDA_DESTINO, PRODUCTO_NORMAL), 0);
});

test("recepciones concurrentes no duplican inventario", { concurrency: false }, async () => {
  const creado = await crearTraspasoNormal(3);
  const usuarioDestino = {
    id: 1,
    rol: "administrador",
    tienda_id: TIENDA_DESTINO,
  };
  const respuestas = await Promise.all([
    invocarControlador(recibirTraspaso, {
      params: { id: creado.body.traspaso_id },
      usuario: usuarioDestino,
    }),
    invocarControlador(recibirTraspaso, {
      params: { id: creado.body.traspaso_id },
      usuario: usuarioDestino,
    }),
  ]);

  assert.equal(respuestas.filter((item) => item.status === 200).length, 1);
  assert.equal(await cantidadInventario(TIENDA_DESTINO, PRODUCTO_NORMAL), 3);
});

test("cancelaciones concurrentes no restauran inventario dos veces", { concurrency: false }, async () => {
  const creado = await crearTraspasoNormal(3);
  const respuestas = await Promise.all([
    invocarControlador(cancelarTraspaso, {
      params: { id: creado.body.traspaso_id },
    }),
    invocarControlador(cancelarTraspaso, {
      params: { id: creado.body.traspaso_id },
    }),
  ]);

  assert.equal(respuestas.filter((item) => item.status === 200).length, 1);
  assert.equal(await cantidadInventario(TIENDA_ORIGEN, PRODUCTO_NORMAL), 10);
});
