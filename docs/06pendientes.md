# Pendientes y decisiones por resolver

## 1. Sincronización entre tiendas

Pendiente definir cómo se sincronizarán las tiendas cuando haya internet.

Opciones posibles:

- Servidor en tienda principal.
- Servidor en la nube.
- Sincronización manual por archivo.
- Sincronización híbrida.

Decisión provisional:

- El sistema debe funcionar primero localmente.
- La sincronización avanzada se resolverá después del prototipo inicial.

---

## 2. Báscula digital

Las tiendas usan báscula digital para productos por peso.

Pendiente definir si en el futuro se integrará directamente con el sistema.

Decisión provisional:

- En la primera versión, el usuario capturará manualmente el peso o importe mostrado por la báscula.
- La integración automática con báscula queda para una versión futura.

---

## 3. Tickets impresos

Pendiente definir si se imprimirán tickets para clientes.

Decisión provisional:

- No será obligatorio en la primera versión.
- Puede agregarse después.

---

## 4. Código de barras interno

Pendiente definir si se crearán códigos internos para productos sin código de barras.

Ejemplos:

- Jamón.
- Queso.
- Salchicha.
- Azúcar.
- Huevo.

Decisión provisional:

- En la primera versión, estos productos se seleccionarán manualmente o con botones rápidos.
- Más adelante se podrán crear códigos internos o etiquetas.

---

## 5. Fiado

Pendiente definir qué tan completo será el módulo de fiado.

Dudas:

- Si se registrará cliente con teléfono.
- Si se permitirá límite de deuda.
- Si se registrarán abonos parciales.
- Si se permitirá bloquear fiado a clientes morosos.

Decisión provisional:

- La primera versión solo registrará cliente, total, abonos y saldo pendiente.

---

## 6. Precios por tienda

Ya se definió que puede existir precio global y precio especial por tienda.

Pendiente definir:

- Qué productos tendrán precio especial.
- Quién revisará esos precios.
- Cada cuánto se actualizarán.

Decisión provisional:

- Se usará precio global por defecto.
- Solo se agregará precio especial cuando sea necesario.

---

## 7. Inventario físico

Pendiente definir cada cuánto se harán conteos físicos.

Opciones:

- Diario.
- Semanal.
- Mensual.
- Por producto sospechoso.

Decisión provisional:

- El sistema debe permitir comparar inventario esperado contra inventario físico.
- La frecuencia se definirá después.

---

## 8. Permisos de empleados

Pendiente definir si algunos empleados tendrán más permisos que otros.

Decisión provisional:

- Primera versión solo tendrá dos roles:
  - Administrador.
  - Empleado.

---

## 9. Funcionamiento sin luz

El sistema no puede funcionar si la computadora está apagada por falta de luz.

Pendiente definir si se usará:

- Laptop con batería.
- No-break/UPS.
- Registro manual temporal en libreta.
- Captura posterior en sistema.

Decisión provisional:

- Si se va la luz, se registrará manualmente y después se capturará en el sistema.
- Más adelante se evaluará usar no-break o laptop.

---

## 10. Prioridad del primer prototipo

La primera versión debe enfocarse en:

- Productos.
- Código de barras.
- Productos por peso.
- Ventas.
- Inventario por tienda.
- Entradas.
- Traspasos.
- Devoluciones.
- Cortes básicos.
- Historial.

No se debe intentar construir todo al mismo tiempo.