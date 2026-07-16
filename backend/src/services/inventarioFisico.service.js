const EPSILON_INVENTARIO = 1e-9;
let dbCompartida = null;

// Las funciones puras se pueden importar y probar sin abrir la base activa.
// La conexion solo se carga cuando una operacion SQL realmente la necesita.
function obtenerDb() {
  if (!dbCompartida) {
    dbCompartida = require("../database/connection");
  }

  return dbCompartida;
}

function crearErrorInventario(mensaje, status = 400, codigo = "INVENTARIO_INVALIDO") {
  const error = new Error(mensaje);
  error.status = status;
  error.codigo = codigo;
  return error;
}

function normalizarId(valor, nombre) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw crearErrorInventario(`${nombre} invalido`);
  }

  return id;
}

function normalizarCantidad(valor, nombre = "Cantidad") {
  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw crearErrorInventario(`${nombre} invalida`);
  }

  return cantidad;
}

/**
 * Traduce una cantidad comercial a la unica fila que representa inventario
 * fisico. Es una funcion pura para que ventas y otros flujos puedan reutilizar
 * exactamente la misma regla despues de cargar el producto.
 */
function resolverImpactoInventario(productoSolicitado, cantidadSolicitada) {
  if (!productoSolicitado || typeof productoSolicitado !== "object") {
    throw crearErrorInventario("Producto invalido");
  }

  const productoComercialId = normalizarId(
    productoSolicitado.id ?? productoSolicitado.producto_id,
    "Producto"
  );
  const cantidadComercial = normalizarCantidad(cantidadSolicitada);
  const esDerivado = Number(productoSolicitado.es_derivado || 0) === 1;

  let productoFisicoId = productoComercialId;
  let factorAplicado = 1;

  if (esDerivado) {
    if (
      Object.prototype.hasOwnProperty.call(
        productoSolicitado,
        "padre_existente_id"
      ) &&
      !productoSolicitado.padre_existente_id
    ) {
      throw crearErrorInventario(
        "El producto derivado no tiene un padre existente"
      );
    }

    if (Number(productoSolicitado.padre_es_derivado || 0) === 1) {
      throw crearErrorInventario(
        "No se permiten cadenas de productos derivados"
      );
    }

    productoFisicoId = normalizarId(
      productoSolicitado.producto_padre_id,
      "Producto padre"
    );
    factorAplicado = Number(productoSolicitado.factor_conversion);

    if (!Number.isFinite(factorAplicado) || factorAplicado <= 0) {
      throw crearErrorInventario("Factor de conversion invalido");
    }

    if (productoFisicoId === productoComercialId) {
      throw crearErrorInventario("Un producto derivado no puede ser su propio padre");
    }
  }

  const cantidadFisica = Number((cantidadComercial * factorAplicado).toFixed(9));

  if (!Number.isFinite(cantidadFisica) || cantidadFisica <= 0) {
    throw crearErrorInventario("El impacto fisico calculado es invalido");
  }

  return {
    producto_comercial: productoSolicitado,
    producto_comercial_id: productoComercialId,
    producto_fisico: esDerivado
      ? {
          id: productoFisicoId,
          nombre:
            productoSolicitado.producto_fisico_nombre ??
            productoSolicitado.padre_nombre ??
            null,
          unidad:
            productoSolicitado.unidad_fisica ??
            productoSolicitado.padre_unidad ??
            null,
        }
      : productoSolicitado,
    producto_fisico_id: productoFisicoId,
    cantidad_comercial: cantidadComercial,
    cantidad_fisica: cantidadFisica,
    factor_aplicado: factorAplicado,
    es_derivado: esDerivado,
  };
}

/**
 * Expresa un saldo fisico en unidades enteras vendibles del producto derivado.
 * El pequeno epsilon evita perder una unidad por ruido binario, nunca redondea
 * hacia arriba una fraccion comercial real.
 */
function calcularDisponibilidadComercial(cantidadFisica, factorConversion) {
  const saldoFisico = Number(cantidadFisica);
  const factor = Number(factorConversion);

  if (!Number.isFinite(saldoFisico) || saldoFisico <= 0) return 0;

  if (!Number.isFinite(factor) || factor <= 0) {
    throw crearErrorInventario("Factor de conversion invalido");
  }

  return Math.max(0, Math.floor(saldoFisico / factor + EPSILON_INVENTARIO));
}

function tieneInventarioSuficiente(cantidadActual, cantidadRequerida) {
  const actual = Number(cantidadActual);
  const requerida = Number(cantidadRequerida);

  return (
    Number.isFinite(actual) &&
    Number.isFinite(requerida) &&
    requerida > 0 &&
    actual + EPSILON_INVENTARIO >= requerida
  );
}

function resolverMovimiento(
  productoId,
  cantidadComercial,
  opciones = {},
  callback
) {
  const db = obtenerDb();
  const productoIdNumero = Number(productoId);

  if (!Number.isInteger(productoIdNumero) || productoIdNumero <= 0) {
    return callback(crearErrorInventario("Producto invalido"));
  }

  const filtroActivo = opciones.permitirInactivo ? "" : "AND p.activo = 1";

  db.get(
    `
      SELECT
        p.*,
        padre.id AS padre_existente_id,
        padre.es_derivado AS padre_es_derivado,
        padre.unidad AS unidad_fisica,
        padre.nombre AS producto_fisico_nombre
      FROM productos p
      LEFT JOIN productos padre ON padre.id = p.producto_padre_id
      WHERE p.id = ?
      ${filtroActivo}
    `,
    [productoIdNumero],
    (error, producto) => {
      if (error) return callback(error);

      if (!producto) {
        return callback(
          crearErrorInventario("Producto no encontrado", 404, "PRODUCTO_NO_ENCONTRADO")
        );
      }

      const esDerivado = Number(producto.es_derivado || 0) === 1;

      if (esDerivado && !producto.padre_existente_id) {
        return callback(
          crearErrorInventario("El producto derivado no tiene un padre valido")
        );
      }

      if (esDerivado && Number(producto.padre_es_derivado || 0) === 1) {
        return callback(
          crearErrorInventario("No se permiten cadenas de productos derivados")
        );
      }

      let impacto;

      try {
        impacto = resolverImpactoInventario(producto, cantidadComercial);
      } catch (errorImpacto) {
        return callback(errorImpacto);
      }

      callback(null, {
        ...impacto,
        producto: producto,
        producto_comercial_nombre: producto.nombre,
        producto_fisico_nombre: esDerivado
          ? producto.producto_fisico_nombre
          : producto.nombre,
        unidad_comercial: producto.unidad,
        unidad_fisica: esDerivado ? producto.unidad_fisica : producto.unidad,
      });
    }
  );
}

function consultarSaldo(tiendaId, productoFisicoId, callback) {
  const db = obtenerDb();
  let tiendaIdNumero;
  let productoFisicoIdNumero;

  try {
    tiendaIdNumero = normalizarId(tiendaId, "Tienda");
    productoFisicoIdNumero = normalizarId(
      productoFisicoId,
      "Producto fisico"
    );
  } catch (error) {
    return callback(error);
  }

  db.get(
    `
      SELECT id, cantidad_actual, cantidad_minima, cantidad_maxima
      FROM inventario
      WHERE tienda_id = ? AND producto_id = ?
    `,
    [tiendaIdNumero, productoFisicoIdNumero],
    callback
  );
}

function sumarInventario(tiendaId, impacto, callback) {
  const db = obtenerDb();
  db.run(
    `
      INSERT INTO inventario (
        tienda_id,
        producto_id,
        cantidad_actual,
        ultima_actualizacion
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(tienda_id, producto_id)
      DO UPDATE SET
        cantidad_actual = cantidad_actual + excluded.cantidad_actual,
        ultima_actualizacion = CURRENT_TIMESTAMP
    `,
    [tiendaId, impacto.producto_fisico_id, impacto.cantidad_fisica],
    function (error) {
      callback(error, this);
    }
  );
}

function descontarInventario(tiendaId, impacto, callback) {
  const db = obtenerDb();
  db.run(
    `
      UPDATE inventario
      SET
        cantidad_actual = cantidad_actual - ?,
        ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE tienda_id = ?
        AND producto_id = ?
        AND cantidad_actual + ? >= ?
    `,
    [
      impacto.cantidad_fisica,
      tiendaId,
      impacto.producto_fisico_id,
      EPSILON_INVENTARIO,
      impacto.cantidad_fisica,
    ],
    function (error) {
      if (error) return callback(error);

      if (this.changes !== 1) {
        return callback(
          crearErrorInventario(
            "Inventario fisico insuficiente",
            409,
            "INVENTARIO_INSUFICIENTE"
          )
        );
      }

      callback(null, this);
    }
  );
}

function establecerSaldoFisico(tiendaId, impacto, cantidadNueva, callback) {
  const db = obtenerDb();
  if (impacto.es_derivado) {
    return callback(
      crearErrorInventario(
        `Ajusta el producto padre ${impacto.producto_fisico_nombre || impacto.producto_fisico_id}`,
        400,
        "AJUSTE_DERIVADO_NO_PERMITIDO"
      )
    );
  }

  const cantidad = Number(cantidadNueva);

  if (!Number.isFinite(cantidad) || cantidad < 0) {
    return callback(crearErrorInventario("Cantidad nueva invalida"));
  }

  db.run(
    `
      UPDATE inventario
      SET cantidad_actual = ?, ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE tienda_id = ? AND producto_id = ?
    `,
    [cantidad, tiendaId, impacto.producto_fisico_id],
    function (error) {
      if (error) return callback(error);

      if (this.changes !== 1) {
        return callback(
          crearErrorInventario(
            "Inventario fisico no encontrado",
            404,
            "INVENTARIO_NO_ENCONTRADO"
          )
        );
      }

      callback(null, this);
    }
  );
}

function obtenerDisponibilidadComercial(
  tiendaId,
  productoId,
  opciones = {},
  callback
) {
  resolverMovimiento(productoId, 1, opciones, (error, impacto) => {
    if (error) return callback(error);

    consultarSaldo(tiendaId, impacto.producto_fisico_id, (errorSaldo, saldo) => {
      if (errorSaldo) return callback(errorSaldo);

      const cantidadFisica = Number(saldo?.cantidad_actual || 0);
      const cantidadComercial = impacto.es_derivado
        ? calcularDisponibilidadComercial(
            cantidadFisica,
            impacto.factor_aplicado
          )
        : cantidadFisica;

      callback(null, {
        ...impacto,
        inventario_id: saldo?.id || null,
        cantidad_fisica_actual: cantidadFisica,
        cantidad_comercial_disponible: cantidadComercial,
        cantidad_minima: Number(saldo?.cantidad_minima || 0),
        cantidad_maxima: Number(saldo?.cantidad_maxima || 0),
      });
    });
  });
}

function agruparPorProductoInventario(movimientos = []) {
  const agrupados = new Map();

  movimientos.forEach((movimiento) => {
    const id = Number(movimiento.producto_fisico_id);
    const previo = agrupados.get(id) || {
      producto_fisico_id: id,
      cantidad_fisica: 0,
    };

    previo.cantidad_fisica = Number(
      (previo.cantidad_fisica + Number(movimiento.cantidad_fisica)).toFixed(9)
    );
    agrupados.set(id, previo);
  });

  return Array.from(agrupados.values());
}

module.exports = {
  agruparPorProductoInventario,
  calcularDisponibilidadComercial,
  consultarSaldo,
  descontarInventario,
  establecerSaldoFisico,
  obtenerDisponibilidadComercial,
  resolverImpactoInventario,
  resolverMovimiento,
  sumarInventario,
  tieneInventarioSuficiente,
};
