PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tiendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administrador', 'empleado')),
  tienda_id INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TEXT,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_producto TEXT NOT NULL CHECK (tipo_producto IN ('codigo_barras', 'peso_variable', 'manual')),
  codigo_barras TEXT UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  presentacion TEXT,
  unidad TEXT NOT NULL,
  precio_global REAL NOT NULL,
  costo_compra REAL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  requiere_caducidad INTEGER NOT NULL DEFAULT 0,
  es_derivado INTEGER NOT NULL DEFAULT 0,
  producto_padre_id INTEGER,
  factor_conversion REAL NOT NULL DEFAULT 1,
  es_retornable INTEGER NOT NULL DEFAULT 0,
  tipo_envase_id INTEGER,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS precios_tienda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  tienda_id INTEGER NOT NULL,
  precio_especial REAL NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_inicio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_admin_id INTEGER,
  motivo TEXT,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_admin_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad_actual REAL NOT NULL DEFAULT 0,
  cantidad_minima REAL DEFAULT 0,
  cantidad_maxima REAL DEFAULT 0,
  ultima_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  UNIQUE (tienda_id, producto_id)
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'fiado', 'mixto')),
  estado TEXT NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'cancelada', 'devuelta_parcial', 'devuelta_total')),
  fecha_venta TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS venta_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  codigo_barras TEXT,
  nombre_producto TEXT NOT NULL,
  tipo_producto TEXT NOT NULL,
  cantidad REAL NOT NULL,
  unidad TEXT NOT NULL,
  precio_unitario REAL NOT NULL,
  subtotal REAL NOT NULL,

  promocion_id INTEGER,
  precio_unitario_original REAL,
  precio_unitario_final REAL,
  cantidad_promocion_aplicada INTEGER DEFAULT 0,
  descuento_promocion REAL DEFAULT 0,

  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (promocion_id) REFERENCES promociones(id)
);

CREATE TABLE IF NOT EXISTS venta_pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'fiado')),
  monto REAL NOT NULL,
  cliente_fiado_id INTEGER,
  observaciones TEXT,
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (cliente_fiado_id) REFERENCES clientes_fiado(id)
);

CREATE TABLE IF NOT EXISTS venta_servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'servicio')),
  descripcion TEXT NOT NULL,
  monto_base REAL NOT NULL,
  comision REAL NOT NULL DEFAULT 0,
  total_cobrado REAL NOT NULL,
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id)
);


CREATE TABLE IF NOT EXISTS entradas_mercancia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  proveedor TEXT,
  observaciones TEXT,
  fecha_entrada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS entrada_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entrada_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  costo_unitario REAL DEFAULT 0,
  fecha_caducidad TEXT,
  FOREIGN KEY (entrada_id) REFERENCES entradas_mercancia(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS devoluciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  observaciones TEXT,
  fecha_devolucion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS devolucion_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devolucion_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  estado_producto TEXT NOT NULL CHECK (estado_producto IN ('regresa_inventario', 'no_regresa_inventario', 'requiere_revision')),
  monto_devuelto REAL DEFAULT 0,
  FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS traspasos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_origen_id INTEGER NOT NULL,
  tienda_destino_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'enviado' CHECK (estado IN ('pendiente', 'enviado', 'recibido', 'cancelado')),
  fecha_envio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_recepcion TEXT,
  FOREIGN KEY (tienda_origen_id) REFERENCES tiendas(id),
  FOREIGN KEY (tienda_destino_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS traspaso_detalles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  traspaso_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  FOREIGN KEY (traspaso_id) REFERENCES traspasos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS mermas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('caducado', 'dañado', 'roto', 'faltante', 'robo_sospechado', 'error_captura', 'otro')),
  observaciones TEXT,
  fecha_merma TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS cortes_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  total_efectivo REAL NOT NULL DEFAULT 0,
  total_transferencia REAL NOT NULL DEFAULT 0,
  total_fiado REAL NOT NULL DEFAULT 0,
  total_gastos REAL NOT NULL DEFAULT 0,
  total_devoluciones REAL NOT NULL DEFAULT 0,
  dinero_esperado REAL NOT NULL DEFAULT 0,
  dinero_real REAL NOT NULL DEFAULT 0,
  diferencia REAL NOT NULL DEFAULT 0,
  observaciones TEXT,
  fecha_corte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  monto REAL NOT NULL,
  observaciones TEXT,
  fecha_gasto TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);


CREATE TABLE IF NOT EXISTS envases_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  cantidad_vacia_actual INTEGER NOT NULL DEFAULT 0,
  ultima_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id),
  UNIQUE (tienda_id, tipo_envase_id)
);

CREATE TABLE IF NOT EXISTS movimientos_envase (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('cobro_envase', 'devolucion_envase', 'prestamo_envase', 'regreso_prestamo', 'ajuste_envase', 'perdida_envase')),
  cantidad INTEGER NOT NULL,
  importe_unitario REAL DEFAULT 0,
  importe_total REAL DEFAULT 0,
  cliente_nombre TEXT,
  observaciones TEXT,
  fecha_movimiento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id)
);

CREATE TABLE IF NOT EXISTS prestamos_envase (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  cliente_nombre TEXT NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  importe_no_cobrado REAL NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'devuelto', 'perdido', 'cancelado')),
  observaciones TEXT,
  fecha_prestamo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion TEXT,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  tienda_id INTEGER,
  accion TEXT NOT NULL,
  tabla_afectada TEXT,
  registro_id INTEGER,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  ip_local TEXT,
  fecha_accion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (
    tipo_movimiento IN (
      'fondo_inicial',
      'entrada_dinero',
      'salida_dinero',
      'pago_proveedor',
      'retiro',
      'ajuste'
    )
  ),
  monto REAL NOT NULL,
  concepto TEXT NOT NULL,
  observaciones TEXT,
  fecha_movimiento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ajustes_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,

  cantidad_anterior REAL NOT NULL,
  cantidad_nueva REAL NOT NULL,
  diferencia REAL NOT NULL,

  motivo TEXT NOT NULL,
  observaciones TEXT,

  fecha_ajuste TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS devoluciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  venta_id INTEGER NOT NULL,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,

  motivo TEXT NOT NULL,
  total_devuelto REAL NOT NULL,

  fecha_devolucion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS tipos_envase (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT NOT NULL,
  nombre TEXT NOT NULL,
  importe REAL NOT NULL,
  cantidad_por_caja INTEGER,
  importe_por_caja REAL,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventario_envases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  cantidad_vacios INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tienda_id, tipo_envase_id)
);

CREATE TABLE IF NOT EXISTS ajustes_envases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  cantidad_anterior INTEGER NOT NULL,
  cantidad_nueva INTEGER NOT NULL,
  diferencia INTEGER NOT NULL,
  modo TEXT NOT NULL CHECK (modo IN ('sumar', 'restar', 'definir')),
  motivo TEXT NOT NULL,
  observaciones TEXT,
  fecha_ajuste TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id)
);

CREATE TABLE IF NOT EXISTS importes_envases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tienda_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  cliente TEXT NOT NULL,
  tipo_envase_id INTEGER NOT NULL,
  escenario TEXT NOT NULL CHECK (
    escenario IN ('dejo_importe', 'trajo_envase', 'envase_prestado')
  ),
  cantidad INTEGER NOT NULL,
  cantidad_pendiente INTEGER NOT NULL,
  importe_unitario REAL NOT NULL,
  importe_total REAL NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observaciones TEXT,
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tipo_envase_id) REFERENCES tipos_envase(id)
);

CREATE TABLE IF NOT EXISTS accesos_usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tienda_id INTEGER,
  fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
);


CREATE TABLE IF NOT EXISTS clientes_fiado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_completo TEXT NOT NULL,
  apodo TEXT,
  telefono TEXT,
  limite_credito REAL NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fiados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tienda_id INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  monto REAL NOT NULL,
  fecha_fiado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes_fiado(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
);

CREATE TABLE IF NOT EXISTS abonos_fiado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tienda_id INTEGER NOT NULL,
  monto REAL NOT NULL,
  observaciones TEXT,
  fecha_abono TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes_fiado(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
);

CREATE TABLE IF NOT EXISTS promociones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  cantidad_requerida INTEGER NOT NULL,
  precio_promocion REAL NOT NULL,
  activa INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT,

  FOREIGN KEY (producto_id) REFERENCES productos(id)
);
