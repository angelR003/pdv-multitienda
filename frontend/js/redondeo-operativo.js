(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.RedondeoOperativo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function redondearAMedioPeso(monto) {
    return Math.round(Number(monto || 0) * 2) / 2;
  }

  function esProductoAGranel(producto) {
    const tipo = String(producto && producto.tipo_producto ? producto.tipo_producto : "")
      .trim()
      .toLowerCase();
    const unidad = String(producto && producto.unidad ? producto.unidad : "")
      .trim()
      .toLowerCase();

    return (
      tipo === "peso_variable" ||
      tipo === "granel" ||
      tipo === "peso" ||
      unidad === "kg" ||
      unidad === "kilo" ||
      unidad === "kilogramo" ||
      unidad === "kilogramo(s)"
    );
  }

  function calcularSubtotalOperativo(producto, subtotalBase) {
    const subtotal = Number(subtotalBase || 0);

    if (esProductoAGranel(producto)) {
      return redondearAMedioPeso(subtotal);
    }

    return subtotal;
  }

  return {
    redondearAMedioPeso,
    esProductoAGranel,
    calcularSubtotalOperativo,
  };
});
