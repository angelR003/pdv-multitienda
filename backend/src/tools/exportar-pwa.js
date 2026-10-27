"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const FORMAT = "pdv-las-gardenias-backup";
const FORMAT_VERSION = 2;
const BUSINESS_STORES = [
  "abonos_fiado", "accesos_usuarios", "ajustes_envases", "ajustes_inventario",
  "auditoria", "clientes_fiado", "cortes_caja", "devolucion_detalles",
  "devoluciones", "entrada_detalles", "entradas_mercancia", "envases_inventario",
  "fiados", "gastos", "importes_envases", "inventario", "inventario_envases",
  "mermas", "movimientos_caja", "movimientos_envase", "operaciones_abono_fiado",
  "precios_tienda", "prestamos_envase", "productos", "promociones", "tiendas",
  "tipos_envase", "traspaso_detalles", "traspasos", "usuarios", "venta_detalles",
  "venta_pagos", "venta_servicios", "ventas"
];

const FOREIGN_KEYS = {
  abonos_fiado: { cliente_id: "clientes_fiado", usuario_id: "usuarios", tienda_id: "tiendas" },
  accesos_usuarios: { usuario_id: "usuarios", tienda_id: "tiendas" },
  ajustes_envases: { tienda_id: "tiendas", usuario_id: "usuarios", tipo_envase_id: "tipos_envase" },
  ajustes_inventario: { tienda_id: "tiendas", usuario_id: "usuarios", producto_id: "productos" },
  auditoria: { usuario_id: "usuarios", tienda_id: "tiendas" },
  cortes_caja: { tienda_id: "tiendas", usuario_id: "usuarios" },
  devolucion_detalles: { devolucion_id: "devoluciones", producto_id: "productos", servicio_id: "venta_servicios" },
  devoluciones: { venta_id: "ventas", tienda_id: "tiendas", usuario_id: "usuarios" },
  entrada_detalles: { entrada_id: "entradas_mercancia", producto_id: "productos" },
  entradas_mercancia: { tienda_id: "tiendas", usuario_id: "usuarios" },
  envases_inventario: { tienda_id: "tiendas", tipo_envase_id: "tipos_envase" },
  fiados: { cliente_id: "clientes_fiado", usuario_id: "usuarios", tienda_id: "tiendas" },
  gastos: { tienda_id: "tiendas", usuario_id: "usuarios" },
  importes_envases: { tienda_id: "tiendas", usuario_id: "usuarios", tipo_envase_id: "tipos_envase", cliente_fiado_id: "clientes_fiado" },
  inventario: { tienda_id: "tiendas", producto_id: "productos" },
  inventario_envases: { tienda_id: "tiendas", tipo_envase_id: "tipos_envase" },
  mermas: { tienda_id: "tiendas", usuario_id: "usuarios", producto_id: "productos" },
  movimientos_caja: { tienda_id: "tiendas", usuario_id: "usuarios" },
  movimientos_envase: { tienda_id: "tiendas", usuario_id: "usuarios", tipo_envase_id: "tipos_envase" },
  operaciones_abono_fiado: { cliente_id: "clientes_fiado", abono_id: "abonos_fiado", movimiento_caja_id: "movimientos_caja" },
  precios_tienda: { producto_id: "productos", tienda_id: "tiendas", usuario_admin_id: "usuarios" },
  prestamos_envase: { tienda_id: "tiendas", usuario_id: "usuarios", tipo_envase_id: "tipos_envase" },
  productos: { producto_padre_id: "productos", tipo_envase_id: "tipos_envase" },
  promociones: { producto_id: "productos" },
  traspaso_detalles: { traspaso_id: "traspasos", producto_id: "productos" },
  traspasos: { tienda_origen_id: "tiendas", tienda_destino_id: "tiendas", usuario_id: "usuarios" },
  usuarios: { tienda_id: "tiendas" },
  venta_detalles: { venta_id: "ventas", producto_id: "productos", promocion_id: "promociones" },
  venta_pagos: { venta_id: "ventas", cliente_fiado_id: "clientes_fiado" },
  venta_servicios: { venta_id: "ventas" },
  ventas: { tienda_id: "tiendas", usuario_id: "usuarios" }
};

const DATE_FIELDS = [
  "updated_at", "fecha_actualizacion", "fecha_creacion", "fecha_venta", "fecha_registro",
  "fecha_movimiento", "fecha_entrada", "fecha_ajuste", "fecha_corte", "fecha_fiado",
  "fecha_abono", "fecha_envio", "fecha_prestamo", "fecha_devolucion", "fecha_accion",
  "ultimo_acceso"
];

function deterministicUuid(table, legacyId) {
  const hex = crypto.createHash("sha256").update(`pdv-las-gardenias:${table}:${legacyId}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function normalizeRecord(table, row, exportedAt, originDeviceId) {
  const legacyId = row.id ?? row.operation_id;
  if (legacyId == null || legacyId === "") throw new Error(`El registro de ${table} no tiene identificador.`);
  const record = { ...row };
  delete record.password_hash;
  record.id = deterministicUuid(table, legacyId);
  record.legacy_id = legacyId;

  for (const [field, referencedTable] of Object.entries(FOREIGN_KEYS[table] || {})) {
    if (row[field] == null || row[field] === "") continue;
    record[`${field}_legacy`] = row[field];
    record[field] = deterministicUuid(referencedTable, row[field]);
  }

  if (table === "clientes_fiado") record.nombre = row.nombre_completo;
  if (table === "tipos_envase") record.importe_deposito = Number(row.importe || 0);
  if (table === "inventario_envases") record.cantidad_actual = Number(row.cantidad_vacios || 0);
  if (table === "envases_inventario") record.cantidad_actual = Number(row.cantidad_vacia_actual || 0);
  if (table === "movimientos_caja") record.motivo = row.concepto;
  if (table === "cortes_caja") {
    record.efectivo_esperado = Number(row.dinero_esperado || 0);
    record.efectivo_contado = Number(row.dinero_real || 0);
  }
  if (table === "devoluciones") record.total = Number(row.total_devuelto || 0);
  if (table === "devolucion_detalles") record.subtotal = Number(row.monto_devuelto || 0);
  if (table === "venta_pagos") record.metodo = row.metodo_pago;
  if (table === "usuarios") record.requiere_configurar_acceso = true;

  const createdAt = DATE_FIELDS.map(field => row[field]).find(Boolean) || exportedAt;
  return {
    ...record,
    created_at: row.created_at || createdAt,
    updated_at: exportedAt,
    deleted_at: null,
    version: 1,
    origin_device_id: originDeviceId,
    sync_status: "imported",
    is_demo: false
  };
}

function enrichRecords(stores) {
  const detailTotals = new Map();
  for (const detail of stores.entrada_detalles || []) {
    detail.subtotal = Number(detail.cantidad || 0) * Number(detail.costo_unitario || 0);
    detailTotals.set(detail.entrada_id, (detailTotals.get(detail.entrada_id) || 0) + detail.subtotal);
  }
  for (const entry of stores.entradas_mercancia || []) entry.total = detailTotals.get(entry.id) || 0;

  const saleDetailPrices = new Map();
  for (const detail of stores.venta_detalles || []) saleDetailPrices.set(`${detail.venta_id}:${detail.producto_id}`, Number(detail.precio_unitario_final ?? detail.precio_unitario ?? 0));
  for (const detail of stores.devolucion_detalles || []) {
    const refund = Number(detail.monto_devuelto || 0);
    detail.precio_unitario = Number(detail.cantidad || 0) > 0 ? refund / Number(detail.cantidad) : 0;
    if (!detail.precio_unitario && detail.producto_id) {
      const refundRecord = (stores.devoluciones || []).find(item => item.id === detail.devolucion_id);
      detail.precio_unitario = saleDetailPrices.get(`${refundRecord?.venta_id}:${detail.producto_id}`) || 0;
    }
    detail.subtotal = refund || detail.precio_unitario * Number(detail.cantidad || 0);
  }
}

function openReadonly(databasePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function close(db) {
  return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
}

async function exportDatabase(databasePath) {
  const resolvedPath = path.resolve(databasePath);
  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) throw new Error("La ruta indicada no es un archivo SQLite.");
  const exportedAt = new Date().toISOString();
  const fingerprint = crypto.createHash("sha256").update(`${resolvedPath}:${stat.size}:${stat.mtimeMs}`).digest("hex").slice(0, 16);
  const originDeviceId = `desktop-${fingerprint}`;
  const database = await openReadonly(resolvedPath);
  try {
    await all(database, "PRAGMA query_only = ON");
    const integrity = await all(database, "PRAGMA quick_check");
    if (!integrity.length || integrity[0].quick_check !== "ok") throw new Error("SQLite no superó PRAGMA quick_check.");
    const tables = new Set((await all(database, "SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name));
    const missing = BUSINESS_STORES.filter(table => !tables.has(table));
    if (missing.length) throw new Error(`Faltan tablas requeridas: ${missing.join(", ")}`);

    const stores = {};
    for (const table of BUSINESS_STORES) {
      const rows = await all(database, `SELECT * FROM "${table}"`);
      stores[table] = rows.map(row => normalizeRecord(table, row, exportedAt, originDeviceId));
    }
    enrichRecords(stores);
    const counts = Object.fromEntries(BUSINESS_STORES.map(table => [table, stores[table].length]));
    return {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      logical_schema_version: 1,
      exported_at: exportedAt,
      source: { type: "sqlite", fingerprint, database_size: stat.size },
      counts,
      stores
    };
  } finally {
    await close(database);
  }
}

function parseArguments(argv) {
  const result = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--db") result.databasePath = argv[++index];
    else if (argv[index] === "--out") result.outputPath = argv[++index];
    else positional.push(argv[index]);
  }
  if (!result.databasePath && positional.length > 1) result.databasePath = positional.shift();
  if (!result.outputPath && positional.length) result.outputPath = positional.shift();
  return result;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const defaultDatabase = process.env.APPDATA ? path.join(process.env.APPDATA, "LasGardenias", "data", "pdv.sqlite") : "";
  const databasePath = args.databasePath || defaultDatabase;
  if (!databasePath || !args.outputPath) {
    throw new Error("Uso: node backend/src/tools/exportar-pwa.js [--db ruta\\pdv.sqlite] --out ruta\\respaldo.pdvbackup");
  }
  const snapshot = await exportDatabase(databasePath);
  const outputPath = path.resolve(args.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(snapshot));
  const total = Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0);
  process.stdout.write(`Respaldo PWA creado: ${outputPath}\nRegistros: ${total}\n`);
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { BUSINESS_STORES, FORMAT, FORMAT_VERSION, deterministicUuid, normalizeRecord, enrichRecords, exportDatabase };
