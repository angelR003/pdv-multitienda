const test = require("node:test");
const assert = require("node:assert/strict");

require("../../frontend/movil/business-rules.js");
const rules = globalThis.PdvBusinessRules;

test("producto normal exige piezas completas y el derivado descuenta al padre", () => {
  assert.equal(rules.validateProductQuantity({ tipo_producto: "manual" }, 1.5).ok, false);
  const impact = rules.resolveInventoryImpact({ id: "hijo", es_derivado: 1, producto_padre_id: "padre", factor_conversion: 0.025, tipo_producto: "manual" }, 40);
  assert.equal(impact.ok, true);
  assert.equal(impact.physicalProductId, "padre");
  assert.equal(impact.physicalQuantity, 1);
});

test("inventario nunca queda negativo", () => {
  assert.equal(rules.validateInventoryAvailability(3, 4).code, "INSUFFICIENT_INVENTORY");
  assert.equal(rules.validateInventoryAvailability(4, 4).remaining, 0);
});

test("precio especial activo reemplaza al global", () => {
  assert.equal(rules.applicablePrice({ precio_global: 20 }, { activo: 1, precio_especial: 18 }), 18);
  assert.equal(rules.applicablePrice({ precio_global: 20 }, { activo: 0, precio_especial: 18 }), 20);
});

test("promociones eligen la combinación más barata", () => {
  const promotion = rules.calculatePromotion(6, 10, [
    { id: "p2", cantidad_requerida: 2, precio_promocion: 18 },
    { id: "p3", cantidad_requerida: 3, precio_promocion: 24 }
  ], { tipo_producto: "manual", es_derivado: 0 });
  assert.equal(promotion.subtotal, 48);
  assert.equal(promotion.discount, 12);
  assert.equal(promotion.promotedQuantity, 6);
});

test("pago mixto debe cuadrar y requiere cliente para fiado", () => {
  assert.equal(rules.validateMixedPayment({ efectivo: 50, transferencia: 40, fiado: 10 }, 100).code, "CREDIT_CUSTOMER_REQUIRED");
  assert.equal(rules.validateMixedPayment({ efectivo: 50, transferencia: 40, fiado: 10, cliente_fiado_id: "cliente" }, 100).ok, true);
  assert.equal(rules.validateMixedPayment({ efectivo: 50, transferencia: 40 }, 100).code, "PAYMENT_TOTAL_MISMATCH");
});

test("límite de crédito se cumple salvo autorización administrativa explícita", () => {
  const blocked = rules.validateCredit({ active: 1, limit: 500, currentDebt: 450, charge: 100 });
  assert.equal(blocked.code, "CREDIT_LIMIT_EXCEEDED");
  const authorized = rules.validateCredit({ active: 1, limit: 500, currentDebt: 450, charge: 100, administratorOverride: true });
  assert.equal(authorized.ok, true);
  assert.equal(authorized.code, "ADMIN_OVERRIDE");
});

test("devolución nunca supera el remanente y los servicios son completos", () => {
  assert.equal(rules.validateReturn({ soldQuantity: 5, returnedQuantity: 2, requestedQuantity: 4 }).code, "RETURN_EXCEEDS_AVAILABLE");
  assert.equal(rules.validateReturn({ soldQuantity: 5, returnedQuantity: 2, requestedQuantity: 3 }).remaining, 0);
  assert.equal(rules.validateReturn({ soldQuantity: 1, requestedQuantity: 0.5, service: true }).code, "FULL_SERVICE_RETURN_REQUIRED");
});

test("cliente con saldos o envases no se puede desactivar", () => {
  assert.equal(rules.canDeactivateCreditCustomer({ debt: 1 }).code, "CUSTOMER_HAS_DEBT");
  assert.equal(rules.canDeactivateCreditCustomer({ creditBalance: 1 }).code, "CUSTOMER_HAS_CREDIT");
  assert.equal(rules.canDeactivateCreditCustomer({ pendingContainers: 1 }).code, "CUSTOMER_HAS_CONTAINERS");
  assert.equal(rules.canDeactivateCreditCustomer({}).ok, true);
});

test("traspaso solo puede recibirse o cancelarse una vez desde enviado", () => {
  assert.equal(rules.validateTransferTransition("enviado", "receive").targetStatus, "recibido");
  assert.equal(rules.validateTransferTransition("recibido", "receive").code, "TRANSFER_ALREADY_RESOLVED");
});

