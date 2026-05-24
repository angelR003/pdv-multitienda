# Diccionario de datos

## 1. Tabla: tiendas

Representa cada sucursal o tienda.

Campos:

- id
- nombre
- ubicacion
- activa
- fecha_creacion

---

## 2. Tabla: usuarios

Representa usuarios del sistema.

Campos:

- id
- nombre
- username
- password_hash
- rol
- tienda_id
- activo
- fecha_creacion
- ultimo_acceso

Roles posibles:

- administrador
- empleado

---

## 3. Tabla: productos

Representa productos registrados.

Campos:

- id
- codigo_barras
- nombre
- categoria
- marca
- presentacion
- unidad
- precio_global
- costo_compra
- activo
- requiere_caducidad
- fecha_creacion

Reglas:

- Si el producto es tipo codigo_barras, el codigo_barras debe ser obligatorio y único.
- Si el producto es tipo peso_variable o manual, el codigo_barras puede quedar vacío.
- Todo producto debe tener un tipo_producto.

Tipos posibles:

- codigo_barras
- peso_variable
- manual
---

## 4. Tabla: precios_tienda

Precios especiales por tienda.

Campos:

- id
- producto_id
- tienda_id
- precio_especial
- activo
- fecha_inicio
- usuario_admin_id
- motivo

---

## 5. Tabla: solicitudes_cambio_precio

Solicitudes hechas por empleados.

Campos:

- id
- producto_id
- tienda_id
- usuario_solicitante_id
- precio_actual
- precio_sugerido
- motivo
- estado
- usuario_respuesta_id
- fecha_solicitud
- fecha_respuesta

Estados:

- pendiente
- aprobado
- rechazado

---

## 6. Tabla: inventario

Inventario por tienda.

Campos:

- id
- tienda_id
- producto_id
- cantidad_actual
- cantidad_minima
- cantidad_maxima
- ultima_actualizacion

Regla:

- una fila por producto y tienda

---

## 7. Tabla: ventas

Representa ventas realizadas.

Campos:

- id
- folio
- tienda_id
- usuario_id
- subtotal
- total
- metodo_pago
- estado
- fecha_venta

Métodos de pago:

- efectivo
- transferencia
- fiado
- mixto

Estados:

- completada
- cancelada
- devuelta_parcial
- devuelta_total

---

## 8. Tabla: venta_detalles

Productos vendidos dentro de una venta.

Campos:

- id
- venta_id
- producto_id
- codigo_barras
- nombre_producto
- cantidad
- precio_unitario
- subtotal

Regla:

- guardar snapshot del producto vendido
- cambios futuros del producto no deben afectar ventas antiguas

---

## 9. Tabla: devoluciones

Registro de devoluciones.

Campos:

- id
- venta_id
- tienda_id
- usuario_id
- motivo
- observaciones
- fecha_devolucion

---

## 10. Tabla: devolucion_detalles

Productos devueltos.

Campos:

- id
- devolucion_id
- producto_id
- cantidad
- estado_producto
- monto_devuelto

Estados producto:

- regresa_inventario
- no_regresa_inventario
- requiere_revision

---

## 11. Tabla: entradas_mercancia

Entradas de productos.

Campos:

- id
- tienda_id
- usuario_id
- proveedor
- observaciones
- fecha_entrada

---

## 12. Tabla: entrada_detalles

Productos recibidos.

Campos:

- id
- entrada_id
- producto_id
- cantidad
- costo_unitario
- fecha_caducidad

---

## 13. Tabla: traspasos

Movimientos entre tiendas.

Campos:

- id
- tienda_origen_id
- tienda_destino_id
- usuario_id
- motivo
- estado
- fecha_envio
- fecha_recepcion

Estados:

- pendiente
- enviado
- recibido
- cancelado

---

## 14. Tabla: traspaso_detalles

Productos trasladados.

Campos:

- id
- traspaso_id
- producto_id
- cantidad

---

## 15. Tabla: mermas

Registro de pérdidas.

Campos:

- id
- tienda_id
- usuario_id
- producto_id
- cantidad
- motivo
- observaciones
- fecha_merma

Motivos:

- caducado
- dañado
- roto
- faltante
- robo_sospechado
- error_captura
- otro

---

## 16. Tabla: cortes_caja

Cortes de caja.

Campos:

- id
- tienda_id
- usuario_id
- total_efectivo
- total_transferencia
- total_fiado
- total_gastos
- total_devoluciones
- dinero_esperado
- dinero_real
- diferencia
- observaciones
- fecha_corte

---

## 17. Tabla: gastos

Gastos hechos desde caja.

Campos:

- id
- tienda_id
- usuario_id
- concepto
- monto
- observaciones
- fecha_gasto

---

## 18. Tabla: fiados

Control de fiado.

Campos:

- id
- cliente_nombre
- telefono
- direccion
- total
- saldo_pendiente
- estado
- fecha_creacion

Estados:

- pendiente
- pagado
- cancelado

---

## 19. Tabla: fiado_abonos

Abonos realizados.

Campos:

- id
- fiado_id
- monto
- usuario_id
- fecha_abono

---

## 20. Tabla: auditoria

Historial general del sistema.

Campos:

- id
- usuario_id
- tienda_id
- accion
- tabla_afectada
- registro_id
- valor_anterior
- valor_nuevo
- ip_local
- fecha_accion

Ejemplos de acciones:

- venta_creada
- venta_cancelada
- precio_modificado
- merma_registrada
- inventario_ajustado
- devolucion_registrada
- traspaso_enviado
- corte_realizado


## Tabla: tipos_envase

Representa tipos de envases retornables.

Campos:

- id
- nombre
- importe
- activo
- fecha_creacion

---
## Tabla: envases_inventario

Inventario de envases vacíos por tienda.

Campos:

- id
- tienda_id
- tipo_envase_id
- cantidad_vacia_actual
- ultima_actualizacion

Reglas:

- Esta tabla solo representa envases vacíos.
- No incluye productos llenos retornables.
- Una Coca-Cola retornable llena cuenta como producto, no como envase vacío.
- Un envase solo entra a esta tabla cuando está vacío y físicamente disponible en tienda.

## Tabla: movimientos_envase

Registra entradas, salidas, cobros, devoluciones y préstamos de envases.

Campos:

- id
- tienda_id
- usuario_id
- tipo_envase_id
- tipo_movimiento
- cantidad
- importe_unitario
- importe_total
- cliente_nombre
- observaciones
- fecha_movimiento

Tipos de movimiento:

- cobro_envase
- devolucion_envase
- prestamo_envase
- regreso_prestamo
- ajuste_envase
- perdida_envase

---

## Tabla: prestamos_envase

Control de envases prestados sin importe.

Campos:

- id
- tienda_id
- usuario_id
- cliente_nombre
- tipo_envase_id
- cantidad
- importe_no_cobrado
- estado
- observaciones
- fecha_prestamo
- fecha_devolucion

Estados:

- pendiente
- devuelto
- perdido
- cancelado