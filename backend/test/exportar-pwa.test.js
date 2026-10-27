"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  deterministicUuid,
  normalizeRecord,
  enrichRecords
} = require("../src/tools/exportar-pwa.js");

const timestamp = "2026-10-26T12:00:00.000Z";

test("los identificadores migrados son UUID deterministas y conservan relaciones", () => {
  const first = deterministicUuid("productos", 42);
  assert.equal(first, deterministicUuid("productos", 42));
  assert.notEqual(first, deterministicUuid("tiendas", 42));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const inventory = normalizeRecord("inventario", { id: 7, tienda_id: 3, producto_id: 42, cantidad_actual: 8 }, timestamp, "desktop-test");
  assert.equal(inventory.id, deterministicUuid("inventario", 7));
  assert.equal(inventory.tienda_id, deterministicUuid("tiendas", 3));
  assert.equal(inventory.producto_id, deterministicUuid("productos", 42));
  assert.equal(inventory.producto_id_legacy, 42);
});

test("la migración omite contraseñas y añade los alias que consume la PWA", () => {
  const user = normalizeRecord("usuarios", { id: 2, username: "caja", password_hash: "secreto", tienda_id: 1 }, timestamp, "desktop-test");
  const client = normalizeRecord("clientes_fiado", { id: 9, nombre_completo: "Cliente real" }, timestamp, "desktop-test");
  assert.equal(Object.hasOwn(user, "password_hash"), false);
  assert.equal(user.requiere_configurar_acceso, true);
  assert.equal(client.nombre, "Cliente real");
});

test("las operaciones idempotentes con operation_id reciben un id móvil válido", () => {
  const operation = normalizeRecord("operaciones_abono_fiado", { operation_id: "abono-2026-01", cliente_id: 9 }, timestamp, "desktop-test");
  assert.equal(operation.legacy_id, "abono-2026-01");
  assert.equal(operation.id, deterministicUuid("operaciones_abono_fiado", "abono-2026-01"));
});

test("el enriquecimiento calcula totales compatibles con las pantallas móviles", () => {
  const stores = {
    entrada_detalles: [{ entrada_id: "e1", cantidad: 3, costo_unitario: 10 }],
    entradas_mercancia: [{ id: "e1" }],
    venta_detalles: [],
    devolucion_detalles: [],
    devoluciones: []
  };
  enrichRecords(stores);
  assert.equal(stores.entrada_detalles[0].subtotal, 30);
  assert.equal(stores.entradas_mercancia[0].total, 30);
});
