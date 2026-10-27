"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

require("fake-indexeddb/auto");
const localValues = new Map();
globalThis.localStorage = {
  getItem: key => localValues.has(key) ? localValues.get(key) : null,
  setItem: (key, value) => localValues.set(key, String(value)),
  removeItem: key => localValues.delete(key)
};
require("../../frontend/movil/db.js");
require("../../frontend/movil/auth.js");

const db = globalThis.PdvLocalDB;
const auth = globalThis.PdvLocalAuth;

test("la base móvil inicia tiendas, usuario, productos e inventario", async () => {
  await db.open();
  const stores = await db.list("tiendas");
  assert.equal(stores.length, 3);
  assert.deepEqual(stores.map(store => store.nombre).sort(), ["Las Gardenias", "Las Gardenias 2", "Los Ángeles"].sort());
  assert.equal((await db.list("usuarios")).length, 1);
  assert.equal((await db.list("productos")).length, 3);
  assert.equal((await db.list("inventario")).length, 3);
});

test("el acceso local valida contraseña, rol y tienda del empleado", async () => {
  const [administrator] = await db.list("usuarios");
  const stores = await db.list("tiendas");
  await auth.setPassword(administrator.id, "admin-seguro");
  const adminSession = await auth.login(administrator.username, "admin-seguro", stores[2].id);
  assert.equal(adminSession.rol, "administrador");
  await assert.rejects(() => auth.login(administrator.username, "incorrecta", stores[0].id), /incorrectos/i);

  const employee = await db.save("usuarios", { nombre: "Empleado local", username: "empleado-local", rol: "empleado", tienda_id: stores[0].id, activo: 1 }, { queue: false });
  await auth.setPassword(employee.id, "empleado-seguro");
  await assert.rejects(() => auth.login(employee.username, "empleado-seguro", stores[1].id), /no pertenece/i);
  assert.equal((await auth.login(employee.username, "empleado-seguro", stores[0].id)).rol, "empleado");
  auth.logout();
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

