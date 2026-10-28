(() => {
  "use strict";

  const RULES_VERSION = 1;
  const MONEY_EPSILON = 0.01;
  const INVENTORY_EPSILON = 1e-9;

  const result = (ok, code = null, message = "", data = {}) => ({ ok, code, message, ...data });
  const roundMoney = value => Math.round(Number(value || 0) * 100) / 100;
  const finiteNumber = value => Number.isFinite(Number(value));
  const allowsFraction = product => product?.tipo_producto === "peso_variable" || Number(product?.es_derivado || 0) === 1;

  const validateProductQuantity = (product, quantity) => {
    const numericQuantity = Number(quantity);
    if (!finiteNumber(quantity) || numericQuantity <= 0) {
      return result(false, "INVALID_QUANTITY", "La cantidad debe ser mayor a cero.");
    }
    if (!allowsFraction(product) && !Number.isInteger(numericQuantity)) {
      return result(false, "WHOLE_UNITS_REQUIRED", "Este producto solo admite piezas completas.");
    }
    return result(true, null, "", { quantity: numericQuantity });
  };

  const resolveInventoryImpact = (product, quantity) => {
    const quantityValidation = validateProductQuantity(product, quantity);
    if (!quantityValidation.ok) return quantityValidation;
    if (!product?.id) return result(false, "PRODUCT_REQUIRED", "El producto es obligatorio.");

    const derived = Number(product.es_derivado || 0) === 1;
    if (!derived) {
      return result(true, null, "", {
        commercialProductId: product.id,
        physicalProductId: product.id,
        commercialQuantity: quantityValidation.quantity,
        physicalQuantity: quantityValidation.quantity,
        conversionFactor: 1,
        derived: false
      });
    }

    const factor = Number(product.factor_conversion);
    if (!product.producto_padre_id || !Number.isFinite(factor) || factor <= 0) {
      return result(false, "INVALID_DERIVED_CONFIGURATION", "El producto derivado no tiene padre o factor válido.");
    }
    return result(true, null, "", {
      commercialProductId: product.id,
      physicalProductId: product.producto_padre_id,
      commercialQuantity: quantityValidation.quantity,
      physicalQuantity: quantityValidation.quantity * factor,
      conversionFactor: factor,
      derived: true
    });
  };

  const validateInventoryAvailability = (currentQuantity, requiredQuantity) => {
    const current = Number(currentQuantity);
    const required = Number(requiredQuantity);
    if (!Number.isFinite(current) || !Number.isFinite(required) || required <= 0) {
      return result(false, "INVALID_INVENTORY", "Las cantidades de inventario son inválidas.");
    }
    if (current + INVENTORY_EPSILON < required) {
      return result(false, "INSUFFICIENT_INVENTORY", "No hay inventario suficiente.", { current, required });
    }
    return result(true, null, "", { current, required, remaining: current - required });
  };

  const validateInventoryLimits = (minimum, maximum) => {
    const min = Number(minimum);
    const max = Number(maximum);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
      return result(false, "INVALID_LIMITS", "Los límites deben ser números no negativos.");
    }
    if (min > max) return result(false, "MIN_GREATER_THAN_MAX", "El mínimo no puede superar al máximo.");
    return result(true, null, "", { minimum: min, maximum: max });
  };

  const applicablePrice = (product, storePrice) => {
    const special = storePrice && Number(storePrice.activo) === 1 ? Number(storePrice.precio_especial) : NaN;
    const global = Number(product?.precio_global);
    if (Number.isFinite(special) && special >= 0) return special;
    return Number.isFinite(global) && global >= 0 ? global : null;
  };

  const calculatePromotion = (quantity, normalPrice, promotions = [], product = {}) => {
    const quantityNumber = Number(quantity);
    const normalPriceNumber = Number(normalPrice);
    const normalSubtotal = roundMoney(quantityNumber * normalPriceNumber);
    const normal = {
      subtotal: normalSubtotal,
      originalSubtotal: normalSubtotal,
      finalUnitPrice: normalPriceNumber,
      originalUnitPrice: normalPriceNumber,
      promotionId: null,
      promotedQuantity: 0,
      discount: 0
    };

    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0 || !Number.isFinite(normalPriceNumber)) return normal;
    if (product.tipo_producto === "peso_variable" || Number(product.es_derivado || 0) === 1) return normal;

    const validPromotions = promotions.map(promotion => ({
      id: promotion.id,
      quantity: Number(promotion.cantidad_requerida),
      priceCents: Math.round(Number(promotion.precio_promocion) * 100)
    })).filter(promotion => Number.isInteger(promotion.quantity) && promotion.quantity >= 2 && promotion.priceCents > 0)
      .sort((a, b) => (a.priceCents / a.quantity) - (b.priceCents / b.quantity) || b.quantity - a.quantity);
    if (!validPromotions.length) return normal;

    const normalPriceCents = Math.round(normalPriceNumber * 100);
    const combinations = Array.from({ length: quantityNumber + 1 }, () => ({ total: 0, promotedQuantity: 0, uses: {} }));
    for (let index = 1; index <= quantityNumber; index += 1) {
      let best = { total: combinations[index - 1].total + normalPriceCents, promotedQuantity: combinations[index - 1].promotedQuantity, uses: { ...combinations[index - 1].uses } };
      validPromotions.forEach(promotion => {
        if (index < promotion.quantity) return;
        const previous = combinations[index - promotion.quantity];
        const candidate = {
          total: previous.total + promotion.priceCents,
          promotedQuantity: previous.promotedQuantity + promotion.quantity,
          uses: { ...previous.uses, [promotion.id]: (previous.uses[promotion.id] || 0) + 1 }
        };
        if (candidate.total < best.total) best = candidate;
      });
      combinations[index] = best;
    }

    const best = combinations[quantityNumber];
    const subtotal = best.total / 100;
    const discount = roundMoney(normalSubtotal - subtotal);
    if (discount <= 0 || best.promotedQuantity <= 0) return normal;
    const mainPromotion = validPromotions.find(promotion => best.uses[promotion.id] > 0);
    return {
      subtotal,
      originalSubtotal: normalSubtotal,
      finalUnitPrice: subtotal / quantityNumber,
      originalUnitPrice: normalPriceNumber,
      promotionId: mainPromotion?.id || null,
      promotedQuantity: best.promotedQuantity,
      discount
    };
  };

  const validateMixedPayment = (payment, total) => {
    const cash = roundMoney(payment?.efectivo);
    const transfer = roundMoney(payment?.transferencia);
    const credit = roundMoney(payment?.fiado);
    const saleTotal = roundMoney(total);
    if ([cash, transfer, credit].some(amount => amount < 0)) {
      return result(false, "NEGATIVE_PAYMENT", "Los pagos no pueden ser negativos.");
    }
    const sum = roundMoney(cash + transfer + credit);
    if (Math.abs(sum - saleTotal) > MONEY_EPSILON) {
      return result(false, "PAYMENT_TOTAL_MISMATCH", "El pago mixto debe sumar exactamente el total.", { sum, total: saleTotal });
    }
    if (credit > 0 && !payment?.cliente_fiado_id) {
      return result(false, "CREDIT_CUSTOMER_REQUIRED", "Selecciona un cliente para la parte fiada.");
    }
    return result(true, null, "", { payment: { efectivo: cash, transferencia: transfer, fiado: credit, cliente_fiado_id: payment?.cliente_fiado_id || null } });
  };

  const RECHARGE_AMOUNTS = Object.freeze([10, 20, 30, 50, 80, 100, 200, 300, 500]);

  const calculateRecharge = (amount, fee = 2) => {
    const baseAmount = roundMoney(amount);
    const commission = roundMoney(fee);
    if (!RECHARGE_AMOUNTS.includes(baseAmount)) {
      return result(false, "INVALID_RECHARGE_AMOUNT", "Selecciona un monto de recarga disponible.");
    }
    if (commission < 0) {
      return result(false, "INVALID_RECHARGE_FEE", "El importe de la recarga no puede ser negativo.");
    }
    return result(true, null, "", {
      amount: baseAmount,
      fee: commission,
      total: roundMoney(baseAmount + commission)
    });
  };

  const canViewUserRecord = ({ isAdmin = false, currentUserId, recordUserId }) => Boolean(isAdmin) || (Boolean(currentUserId) && currentUserId === recordUserId);

  const validateCredit = ({ active, limit, currentDebt, charge, administratorOverride = false }) => {
    if (Number(active) !== 1) return result(false, "INACTIVE_CUSTOMER", "El cliente está inactivo.");
    const creditLimit = roundMoney(limit);
    const debt = Math.max(0, roundMoney(currentDebt));
    const amount = roundMoney(charge);
    if (amount <= 0) return result(false, "INVALID_CREDIT_AMOUNT", "El importe fiado debe ser mayor a cero.");
    const resultingDebt = roundMoney(debt + amount);
    if (resultingDebt > creditLimit && !administratorOverride) {
      return result(false, "CREDIT_LIMIT_EXCEEDED", "La operación supera el límite de crédito.", { creditLimit, debt, amount, resultingDebt });
    }
    return result(true, administratorOverride && resultingDebt > creditLimit ? "ADMIN_OVERRIDE" : null, "", { creditLimit, debt, amount, resultingDebt });
  };

  const validateReturn = ({ soldQuantity, returnedQuantity = 0, requestedQuantity, service = false }) => {
    const sold = Number(soldQuantity);
    const returned = Number(returnedQuantity);
    const requested = Number(requestedQuantity);
    const available = sold - returned;
    if (![sold, returned, requested].every(Number.isFinite) || requested <= 0) {
      return result(false, "INVALID_RETURN_QUANTITY", "La cantidad a devolver es inválida.");
    }
    if (service && requested !== 1) return result(false, "FULL_SERVICE_RETURN_REQUIRED", "Los servicios y recargas se devuelven completos.");
    if (available <= 0) return result(false, "ALREADY_RETURNED", "El renglón ya fue devuelto completamente.");
    if (requested > available + INVENTORY_EPSILON) {
      return result(false, "RETURN_EXCEEDS_AVAILABLE", "La devolución supera la cantidad pendiente.", { available });
    }
    return result(true, null, "", { available, remaining: available - requested });
  };

  const canDeactivateCreditCustomer = ({ debt = 0, creditBalance = 0, pendingContainers = 0 }) => {
    if (Number(debt) > 0) return result(false, "CUSTOMER_HAS_DEBT", "El cliente tiene saldo fiado pendiente.");
    if (Number(creditBalance) > 0) return result(false, "CUSTOMER_HAS_CREDIT", "El cliente tiene saldo a favor.");
    if (Number(pendingContainers) > 0) return result(false, "CUSTOMER_HAS_CONTAINERS", "El cliente tiene envases pendientes.");
    return result(true);
  };

  const validateTransferTransition = (currentStatus, action) => {
    const target = action === "receive" ? "recibido" : action === "cancel" ? "cancelado" : null;
    if (!target) return result(false, "INVALID_TRANSFER_ACTION", "La acción de traspaso es inválida.");
    if (currentStatus !== "enviado") return result(false, "TRANSFER_ALREADY_RESOLVED", "El traspaso ya no está disponible.");
    return result(true, null, "", { targetStatus: target });
  };

  globalThis.PdvBusinessRules = Object.freeze({
    RECHARGE_AMOUNTS,
    calculateRecharge,
    canViewUserRecord,
    RULES_VERSION,
    MONEY_EPSILON,
    INVENTORY_EPSILON,
    roundMoney,
    allowsFraction,
    validateProductQuantity,
    resolveInventoryImpact,
    validateInventoryAvailability,
    validateInventoryLimits,
    applicablePrice,
    calculatePromotion,
    validateMixedPayment,
    validateCredit,
    validateReturn,
    canDeactivateCreditCustomer,
    validateTransferTransition
  });
})();

