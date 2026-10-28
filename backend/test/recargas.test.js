const test = require("node:test");
const assert = require("node:assert/strict");

const { MONTOS_RECARGA, IMPORTE_RECARGA, prepararRecarga } = require("../src/utils/recargas");

test("la computadora y la PWA comparten los nueve montos de recarga", () => {
  assert.deepEqual(MONTOS_RECARGA, [10, 20, 30, 50, 80, 100, 200, 300, 500]);
  assert.equal(IMPORTE_RECARGA, 2);
});

test("una recarga suma dos pesos y rechaza montos fuera del catálogo", () => {
  assert.deepEqual(prepararRecarga(300), { monto_base: 300, comision: 2, total_cobrado: 302 });
  assert.equal(prepararRecarga(15).error, "Selecciona un monto de recarga disponible");
});
