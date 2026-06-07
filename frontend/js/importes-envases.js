(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ImportesEnvases = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function calcularImporteEnvase(tipoEnvase, cantidad) {
    const cantidadNumero = Number(cantidad || 0);
    const importeIndividual = Number(tipoEnvase && tipoEnvase.importe ? tipoEnvase.importe : 0);
    const cantidadPorCaja = Number(tipoEnvase && tipoEnvase.cantidad_por_caja ? tipoEnvase.cantidad_por_caja : 0);
    const importePorCaja = Number(tipoEnvase && tipoEnvase.importe_por_caja ? tipoEnvase.importe_por_caja : 0);
    const categoria = String(tipoEnvase && tipoEnvase.categoria ? tipoEnvase.categoria : "").toLowerCase();

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

  return {
    calcularImporteEnvase,
  };
});
