function calcularImporteEnvase(tipoEnvase, cantidad) {
  const cantidadNumero = Number(cantidad || 0);
  const importeIndividual = Number(tipoEnvase?.importe || 0);
  const cantidadPorCaja = Number(tipoEnvase?.cantidad_por_caja || 0);
  const importePorCaja = Number(tipoEnvase?.importe_por_caja || 0);
  const categoria = String(tipoEnvase?.categoria || "").toLowerCase();

  if (
    categoria !== "cerveza" ||
    !Number.isInteger(cantidadNumero) ||
    cantidadNumero <= 0 ||
    !Number.isInteger(cantidadPorCaja) ||
    cantidadPorCaja <= 0 ||
    importePorCaja <= 0
  ) {
    return importeIndividual * cantidadNumero;
  }

  const cajasCompletas = Math.floor(cantidadNumero / cantidadPorCaja);
  const sobrantes = cantidadNumero % cantidadPorCaja;

  return cajasCompletas * importePorCaja + sobrantes * importeIndividual;
}

module.exports = {
  calcularImporteEnvase,
};
