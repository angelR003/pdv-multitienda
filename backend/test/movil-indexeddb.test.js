"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

require("fake-indexeddb/auto");
require("../../frontend/movil/db.js");

const db = globalThis.PdvLocalDB;

test("la base móvil inicia tiendas, usuario, productos e inventario", async () => {
  await db.open();
  assert.equal((await db.list("tiendas")).length, 2);
  assert.equal((await db.list("usuarios")).length, 1);
  assert.equal((await db.list("productos")).length, 3);
  assert.equal((await db.list("inventario")).length, 3);
});

test("batch guarda una operación completa y la coloca en la bandeja de sincronización", async () => {
  const products = await db.list("productos");
  const product = products[0];
  const inventory = (await db.list("inventario")).find(row => row.producto_id === product.id);
  const saleId = db.uuid();
  const before = (await db.getStatus()).outbox;

  await db.batch([
    { store: "ventas", payload: { id: saleId, folio: "V-TEST", total: 27.5 }, options: { isDemo: false, syncStatus: "pending" } },
    { store: "venta_detalles", payload: { venta_id: saleId, producto_id: product.id, cantidad: 1, subtotal: 27.5 }, options: { isDemo: false, syncStatus: "pending" } },
    { store: "inventario", payload: { ...inventory, cantidad_actual: inventory.cantidad_actual - 1 }, options: { isDemo: false, syncStatus: "pending" } }
  ]);

  assert.equal((await db.get("ventas", saleId)).total, 27.5);
  assert.equal((await db.list("venta_detalles")).filter(row => row.venta_id === saleId).length, 1);
  assert.equal((await db.get("inventario", inventory.id)).cantidad_actual, inventory.cantidad_actual - 1);
  assert.equal((await db.getStatus()).outbox, before + 3);
});

test("un respaldo validado reemplaza los datos de forma atómica y restaura su bandeja", async () => {
  const snapshot = await db.exportSnapshot();
  const temporary = await db.save("productos", { nombre: "Producto que no debe sobrevivir" }, { isDemo: false });
  assert.ok(await db.get("productos", temporary.id));

  const summary = db.validateSnapshot(snapshot);
  assert.equal(summary.totalRecords, Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0));
  await db.importSnapshot(snapshot);

  assert.equal(await db.get("productos", temporary.id), undefined);
  assert.equal((await db.getStatus()).outbox, 3);
  assert.equal((await db.getMeta("last_import")).value.total_records, summary.totalRecords);
});

test("se rechazan archivos ajenos antes de modificar IndexedDB", () => {
  assert.throws(() => db.validateSnapshot({ format: "archivo-ajeno", format_version: 1, stores: {} }), /no son compatibles/i);
});

