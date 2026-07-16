const TOLERANCIA_MONETARIA = 0.005;

function redondearCentavos(monto) {
  return Math.round(Number(monto || 0) * 100) / 100;
}

function derivarEstadoCuenta(saldo) {
  const saldoCalculado = redondearCentavos(saldo);
  const saldoNeto = Math.abs(saldoCalculado) < TOLERANCIA_MONETARIA
    ? 0
    : saldoCalculado;
  const saldoDeudor = saldoNeto > 0 ? saldoNeto : 0;
  const saldoAFavor = saldoNeto < 0 ? redondearCentavos(-saldoNeto) : 0;

  return {
    saldo_neto: saldoNeto,
    saldo_deudor: saldoDeudor,
    saldo_a_favor: saldoAFavor,
    estado_cuenta:
      saldoDeudor > 0
        ? "debe"
        : saldoAFavor > 0
          ? "a_favor"
          : "saldado",
  };
}

function agregarEstadoCuenta(fila) {
  if (!fila) return fila;

  const resumen = derivarEstadoCuenta(
    fila.saldo_neto !== undefined ? fila.saldo_neto : fila.deuda_total
  );

  return {
    ...fila,
    // Alias firmado conservado para consumidores anteriores.
    deuda_total: resumen.saldo_neto,
    ...resumen,
  };
}

module.exports = {
  TOLERANCIA_MONETARIA,
  redondearCentavos,
  derivarEstadoCuenta,
  agregarEstadoCuenta,
};
