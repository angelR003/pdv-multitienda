INSERT INTO tiendas (nombre, ubicacion)
VALUES
('Tienda Centro', 'Centro'),
('Tienda Arriba', 'Parte alta'),
('Tienda Abajo', 'Parte baja');

INSERT INTO usuarios (
  nombre,
  username,
  password_hash,
  rol,
  tienda_id
)
VALUES (
  'Administrador General',
  'admin',
  '123456',
  'administrador',
  1
);

INSERT INTO productos (
  tipo_producto,
  codigo_barras,
  nombre,
  categoria,
  marca,
  presentacion,
  unidad,
  precio_global,
  costo_compra
)
VALUES
(
  'codigo_barras',
  '7501055302568',
  'Pepsi 2L',
  'Refrescos',
  'Pepsi',
  'Botella 2L',
  'pieza',
  32,
  24
),
(
  'codigo_barras',
  '7501000123456',
  'Sabritas Original',
  'Botanas',
  'Sabritas',
  '45g',
  'pieza',
  18,
  12
),
(
  'peso_variable',
  NULL,
  'Jamón',
  'Embutidos',
  'FUD',
  'A granel',
  'kg',
  120,
  90
),
(
  'peso_variable',
  NULL,
  'Huevo',
  'Abarrotes',
  'Genérico',
  'A granel',
  'kg',
  45,
  36
);

INSERT INTO inventario (
  tienda_id,
  producto_id,
  cantidad_actual,
  cantidad_minima,
  cantidad_maxima
)
VALUES
(1, 1, 25, 5, 40),
(1, 2, 40, 10, 60),
(1, 3, 12, 2, 20),
(1, 4, 30, 5, 50),

(2, 1, 5, 5, 40),
(2, 2, 18, 10, 60),

(3, 1, 16, 5, 40);

INSERT INTO tipos_envase (
  nombre,
  importe
)
VALUES
('Caguama', 25),
('Coca-Cola Vidrio', 8),
('Retornable Grande', 20);

INSERT INTO envases_inventario (
  tienda_id,
  tipo_envase_id,
  cantidad_vacia_actual
)
VALUES
(1, 1, 12),
(1, 2, 30),
(2, 1, 4),
(3, 3, 10);