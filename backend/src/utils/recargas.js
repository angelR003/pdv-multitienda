const MONTOS_RECARGA = Object.freeze([10, 20, 30, 50, 80, 100, 200, 300, 500]);
const IMPORTE_RECARGA = 2;

const redondearCentavos = valor => Number(Number(valor || 0).toFixed(2));

const prepararRecarga = monto => {
  const montoBase = redondearCentavos(monto);
  if (!MONTOS_RECARGA.includes(montoBase)) {
    return { error: "Selecciona un monto de recarga disponible" };
  }
  return {
    monto_base: montoBase,
    comision: IMPORTE_RECARGA,
    total_cobrado: redondearCentavos(montoBase + IMPORTE_RECARGA),
  };
};

module.exports = { MONTOS_RECARGA, IMPORTE_RECARGA, prepararRecarga };
