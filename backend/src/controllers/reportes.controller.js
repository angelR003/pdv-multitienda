const db = require("../database/connection");

function normalizarFiltros(req) {
  const hoy = new Date();

  const fechaInicio =
    req.query.fecha_inicio ||
    formatearFechaLocal(hoy);

  const fechaFin =
    req.query.fecha_fin ||
    formatearFechaLocal(hoy);

  const tiendaId = req.query.tienda_id
    ? Number(req.query.tienda_id)
    : null;

  return {
    fechaInicio,
    fechaFin,
    tiendaId,
  };
}

function formatearFechaLocal(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function filtroTienda(alias, tiendaId, params) {
  if (!tiendaId) return "";

  params.push(tiendaId);
  return ` AND ${alias}.tienda_id = ? `;
}

function fechaLocalSql(alias, columna) {
  return `DATE(datetime(${alias}.${columna}, 'localtime'))`;
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

const obtenerTiendas = (req, res) => {
  db.all(
    `
    SELECT id, nombre, ubicacion
    FROM tiendas
    WHERE activa = 1
    ORDER BY nombre ASC
    `,
    [],
    (error, rows) => {
      if (error) {
        return res.status(500).json({
          error: "Error al obtener tiendas",
        });
      }

      res.json(rows);
    }
  );
};

async function consultarVentasPorDia(filtros) {
  const fechaVentaLocal = fechaLocalSql("v", "fecha_venta");
  const params = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaSql = filtroTienda("v", filtros.tiendaId, params);

  return all(
    `
    SELECT
      ${fechaVentaLocal} AS fecha,
      COUNT(*) AS total_ventas,
      COALESCE(SUM(v.total), 0) AS total
    FROM ventas v
    WHERE ${fechaVentaLocal} BETWEEN ? AND ?
    AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
    ${tiendaSql}
    GROUP BY ${fechaVentaLocal}
    ORDER BY fecha ASC
    `,
    params
  );
}

async function consultarMetodosPago(filtros) {
  const fechaVentaLocal = fechaLocalSql("v", "fecha_venta");
  const tiendaSql = filtros.tiendaId ? "AND v.tienda_id = ?" : "";
  const params = [filtros.fechaInicio, filtros.fechaFin];

  if (filtros.tiendaId) {
    params.push(filtros.tiendaId);
  }

  params.push(filtros.fechaInicio, filtros.fechaFin);

  if (filtros.tiendaId) {
    params.push(filtros.tiendaId);
  }

  return all(
    `
    SELECT
      metodo_pago,
      COALESCE(SUM(total_ventas), 0) AS total_ventas,
      COALESCE(SUM(total), 0) AS total
    FROM (
      SELECT
        v.metodo_pago,
        COUNT(*) AS total_ventas,
        COALESCE(SUM(v.total), 0) AS total
      FROM ventas v
      WHERE ${fechaVentaLocal} BETWEEN ? AND ?
      AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
      AND v.metodo_pago != 'mixto'
      ${tiendaSql}
      GROUP BY v.metodo_pago

      UNION ALL

      SELECT
        vp.metodo_pago,
        COUNT(DISTINCT v.id) AS total_ventas,
        COALESCE(SUM(vp.monto), 0) AS total
      FROM venta_pagos vp
      INNER JOIN ventas v
        ON v.id = vp.venta_id
      WHERE ${fechaVentaLocal} BETWEEN ? AND ?
      AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
      AND v.metodo_pago = 'mixto'
      ${tiendaSql}
      GROUP BY vp.metodo_pago
    )
    GROUP BY metodo_pago
    ORDER BY total DESC
    `,
    params
  );
}

async function consultarTopProductos(filtros) {
  const fechaVentaLocal = fechaLocalSql("v", "fecha_venta");
  const params = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaSql = filtroTienda("v", filtros.tiendaId, params);

  return all(
    `
    SELECT
      vd.producto_id,
      vd.nombre_producto,
      vd.unidad,
      COALESCE(SUM(vd.cantidad), 0) AS cantidad_total,
      COALESCE(SUM(vd.subtotal), 0) AS total_vendido
    FROM venta_detalles vd
    INNER JOIN ventas v ON v.id = vd.venta_id
    WHERE ${fechaVentaLocal} BETWEEN ? AND ?
    AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
    ${tiendaSql}
    GROUP BY vd.producto_id, vd.nombre_producto, vd.unidad
    ORDER BY cantidad_total DESC
    LIMIT 10
    `,
    params
  );
}

async function consultarPromocionesUsadas(filtros) {
  const fechaVentaLocal = fechaLocalSql("v", "fecha_venta");
  const params = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaSql = filtroTienda("v", filtros.tiendaId, params);

  return all(
    `
    SELECT
      vd.nombre_producto,
      COUNT(*) AS renglones,
      COALESCE(SUM(vd.cantidad_promocion_aplicada), 0) AS piezas_con_promocion,
      COALESCE(SUM(vd.descuento_promocion), 0) AS ahorro_total
    FROM venta_detalles vd
    INNER JOIN ventas v ON v.id = vd.venta_id
    WHERE ${fechaVentaLocal} BETWEEN ? AND ?
    AND vd.promocion_id IS NOT NULL
    ${tiendaSql}
    GROUP BY vd.producto_id, vd.nombre_producto
    ORDER BY ahorro_total DESC
    LIMIT 10
    `,
    params
  );
}

async function consultarResumen(filtros) {
  const fechaVentaLocal = fechaLocalSql("v", "fecha_venta");
  const fechaDevolucionLocal = fechaLocalSql("d", "fecha_devolucion");
  const paramsVentas = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaVentasSql = filtroTienda("v", filtros.tiendaId, paramsVentas);

  const ventas = await get(
    `
    SELECT
      COUNT(*) AS total_ventas,
      COALESCE(SUM(v.total), 0) AS ventas_total,
      COALESCE(AVG(v.total), 0) AS ticket_promedio,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE 0 END), 0) AS total_efectivo,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS total_transferencia,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'fiado' THEN v.total ELSE 0 END), 0) AS total_fiado,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'mixto' THEN v.total ELSE 0 END), 0) AS total_mixto
    FROM ventas v
    WHERE ${fechaVentaLocal} BETWEEN ? AND ?
    AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
    ${tiendaVentasSql}
    `,
    paramsVentas
  );

  const paramsPagosMixtos = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaPagosMixtosSql = filtroTienda("v", filtros.tiendaId, paramsPagosMixtos);

  const pagosMixtos = await get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN vp.metodo_pago = 'efectivo' THEN vp.monto ELSE 0 END), 0) AS mixto_efectivo,
      COALESCE(SUM(CASE WHEN vp.metodo_pago = 'transferencia' THEN vp.monto ELSE 0 END), 0) AS mixto_transferencia,
      COALESCE(SUM(CASE WHEN vp.metodo_pago = 'fiado' THEN vp.monto ELSE 0 END), 0) AS mixto_fiado
    FROM venta_pagos vp
    INNER JOIN ventas v
      ON v.id = vp.venta_id
    WHERE ${fechaVentaLocal} BETWEEN ? AND ?
    AND v.estado IN ('completada', 'devuelta_parcial', 'devuelta_total')
    AND v.metodo_pago = 'mixto'
    ${tiendaPagosMixtosSql}
    `,
    paramsPagosMixtos
  );

  ventas.total_efectivo = Number(ventas.total_efectivo || 0) + Number(pagosMixtos.mixto_efectivo || 0);
  ventas.total_transferencia = Number(ventas.total_transferencia || 0) + Number(pagosMixtos.mixto_transferencia || 0);
  ventas.total_fiado = Number(ventas.total_fiado || 0) + Number(pagosMixtos.mixto_fiado || 0);

  const paramsDevoluciones = [filtros.fechaInicio, filtros.fechaFin];
  const tiendaDevolucionesSql = filtroTienda("d", filtros.tiendaId, paramsDevoluciones);

  const devoluciones = await get(
    `
    SELECT
      COUNT(*) AS total_devoluciones,
      COALESCE(SUM(d.total_devuelto), 0) AS monto_devoluciones
    FROM devoluciones d
    WHERE ${fechaDevolucionLocal} BETWEEN ? AND ?
    ${tiendaDevolucionesSql}
    `,
    paramsDevoluciones
  );

  const paramsImportes = [];
  const tiendaImportesSql = filtros.tiendaId
    ? "WHERE i.tienda_id = ? AND i.estado = 'pendiente'"
    : "WHERE i.estado = 'pendiente'";

  if (filtros.tiendaId) {
    paramsImportes.push(filtros.tiendaId);
  }

  const importes = await get(
    `
    SELECT
      COUNT(*) AS importes_pendientes,
      COALESCE(SUM(i.cantidad_pendiente), 0) AS envases_pendientes,
      COALESCE(SUM(i.importe_unitario * i.cantidad_pendiente), 0) AS monto_importes_pendientes
    FROM importes_envases i
    ${tiendaImportesSql}
    `,
    paramsImportes
  );

  const paramsTraspasos = [];
  let traspasosSql = "WHERE tr.estado = 'enviado'";

  if (filtros.tiendaId) {
    traspasosSql += " AND tr.tienda_destino_id = ?";
    paramsTraspasos.push(filtros.tiendaId);
  }

  const traspasos = await get(
    `
    SELECT COUNT(*) AS traspasos_pendientes
    FROM traspasos tr
    ${traspasosSql}
    `,
    paramsTraspasos
  );

  return {
    ...ventas,
    ...devoluciones,
    ...importes,
    ...traspasos,
  };
}

async function consultarBajoInventario(filtros) {
  const params = [];

  let tiendaSql = "";

  if (filtros.tiendaId) {
    tiendaSql = "AND i.tienda_id = ?";
    params.push(filtros.tiendaId);
  }

  return all(
    `
    SELECT
      i.tienda_id,
      t.nombre AS tienda,
      p.nombre AS producto,
      p.codigo_barras,
      p.unidad,
      i.cantidad_actual,
      i.cantidad_minima
    FROM inventario i
    INNER JOIN productos p ON p.id = i.producto_id
    INNER JOIN tiendas t ON t.id = i.tienda_id
    WHERE p.activo = 1
    AND i.cantidad_actual <= i.cantidad_minima
    ${tiendaSql}
    ORDER BY i.cantidad_actual ASC, p.nombre ASC
    LIMIT 20
    `,
    params
  );
}

async function consultarFiadosPendientes(filtros) {
  const params = [];
  const condiciones = [
    "f.concepto NOT LIKE 'Envase prestado - %'",
  ];

  if (filtros.tiendaId) {
    condiciones.push("f.tienda_id = ?");
    params.push(filtros.tiendaId);
  }

  const fiadosSql = `WHERE ${condiciones.join(" AND ")}`;

  return all(
    `
    SELECT
      c.id,
      c.nombre_completo,
      COALESCE(SUM(f.monto), 0)
      -
      COALESCE((
        SELECT SUM(a.monto)
        FROM abonos_fiado a
        WHERE a.cliente_id = c.id
        AND COALESCE(a.observaciones, '') NOT LIKE 'Recepción de envase prestado:%'
        AND COALESCE(a.observaciones, '') NOT LIKE 'Recepcion de envase prestado:%'
        AND COALESCE(a.observaciones, '') NOT LIKE 'Cancelacion de envase por devolucion%'
      ), 0) AS deuda_total
    FROM clientes_fiado c
    INNER JOIN fiados f ON f.cliente_id = c.id
    ${fiadosSql}
    GROUP BY c.id, c.nombre_completo
    HAVING deuda_total > 0
    ORDER BY deuda_total DESC
    LIMIT 10
    `,
    params
  );
}

const obtenerResumenReportes = async (req, res) => {
  if (req.usuario.rol !== "administrador") {
    return res.status(403).json({
      error: "Solo administradores pueden ver reportes",
    });
  }

  const filtros = normalizarFiltros(req);

  try {
    const [
      resumen,
      ventas_por_dia,
      metodos_pago,
      top_productos,
      promociones_usadas,
      bajo_inventario,
      fiados_pendientes,
    ] = await Promise.all([
      consultarResumen(filtros),
      consultarVentasPorDia(filtros),
      consultarMetodosPago(filtros),
      consultarTopProductos(filtros),
      consultarPromocionesUsadas(filtros),
      consultarBajoInventario(filtros),
      consultarFiadosPendientes(filtros),
    ]);

    res.json({
      filtros: {
        fecha_inicio: filtros.fechaInicio,
        fecha_fin: filtros.fechaFin,
        tienda_id: filtros.tiendaId,
      },
      resumen,
      ventas_por_dia,
      metodos_pago,
      top_productos,
      promociones_usadas,
      bajo_inventario,
      fiados_pendientes,
    });
  } catch (error) {
    console.error("Error reportes:", error.message);

    res.status(500).json({
      error: "Error al generar reportes",
      detalle: error.message,
    });
  }
};

module.exports = {
  obtenerTiendas,
  obtenerResumenReportes,
};
