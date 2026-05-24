# Reglas del negocio

## 1. Ventas

- Toda venta confirmada debe quedar registrada en historial.
- Ninguna venta debe eliminarse físicamente de la base de datos.
- Una venta cancelada debe conservarse marcada como cancelada.
- Toda venta debe guardar el precio exacto usado en el momento de la venta.
- Cambiar el precio de un producto NO debe modificar ventas antiguas.
- Toda venta debe descontar inventario automáticamente.
- No debe permitirse vender cantidades negativas.
- El sistema debe impedir ventas de productos inexistentes.
- El sistema debe permitir vender aunque no haya internet.
- Toda venta debe quedar asociada a un usuario y tienda.

---

## 2. Productos

- Todo producto debe tener código de barras único.
- No debe existir más de un producto con el mismo código.
- Un producto inactivo no debe poder venderse.
- Los productos deben poder existir aunque no tengan inventario.
- Todo producto debe tener precio base global.
- Un producto puede tener precios especiales por tienda.

---

## 3. Inventario

- El inventario debe manejarse por tienda.
- Ningún movimiento debe alterar inventario sin quedar registrado.
- El inventario nunca debe modificarse silenciosamente.
- Todo ajuste manual debe quedar registrado en historial.
- El sistema debe impedir inventario negativo salvo autorización administrativa futura.
- Toda entrada debe aumentar inventario.
- Toda venta debe disminuir inventario.
- Toda devolución válida debe aumentar inventario.
- Toda merma debe disminuir inventario.
- Todo traspaso confirmado debe mover inventario entre tiendas.

---

## 4. Precios

- Solo administradores pueden modificar precios oficiales.
- Los empleados solo pueden solicitar cambios.
- Todo cambio de precio debe quedar registrado.
- Un precio especial por tienda tiene prioridad sobre el precio global.
- Si no existe precio especial, se usa el precio global.
- Las ventas deben conservar el precio usado aunque después cambie el precio del producto.
- Una tienda sin conexión debe usar el último precio sincronizado disponible.

---

## 5. Usuarios y seguridad

- Todo usuario debe iniciar sesión.
- No deben compartirse cuentas entre empleados.
- Toda acción importante debe guardar usuario, fecha y tienda.
- Los empleados no pueden borrar historial.
- Los empleados no pueden modificar ventas antiguas.
- Los empleados no pueden alterar inventario manualmente.
- Los empleados no pueden cambiar precios oficiales.
- El administrador puede consultar historial completo.

---

## 6. Devoluciones

- Toda devolución debe quedar registrada.
- Ninguna devolución puede eliminarse.
- Toda devolución debe indicar motivo.
- Toda devolución debe indicar estado del producto.
- Si el producto puede regresar a inventario, debe sumarse nuevamente.
- Si el producto no puede regresar a inventario, debe registrarse como merma.
- Toda devolución debe asociarse a usuario y tienda.

---

## 7. Mermas

- Toda merma debe quedar registrada.
- Ninguna merma debe eliminarse.
- Toda merma debe tener motivo.
- Toda merma debe afectar inventario automáticamente.
- Las mermas deben aparecer en reportes administrativos.

---

## 8. Traspasos

- Ningún traspaso debe realizarse sin existencia suficiente.
- Todo traspaso debe guardar origen y destino.
- Un traspaso enviado debe descontar inventario origen.
- Un traspaso recibido debe aumentar inventario destino.
- Todo traspaso debe quedar registrado en historial.

---

## 9. Cortes de caja

- Todo corte debe guardar dinero esperado y dinero real.
- Toda diferencia debe quedar registrada.
- Ningún corte debe eliminarse.
- El sistema debe poder identificar diferencias frecuentes.
- Todo corte debe asociarse a usuario y tienda.

---

## 10. Funcionamiento sin internet

- El sistema debe seguir funcionando sin internet.
- Las ventas offline deben guardarse localmente.
- Los movimientos pendientes deben sincronizarse cuando vuelva la conexión.
- Ningún movimiento debe perderse por falta de internet.
- El sistema debe registrar fecha de última sincronización.

---

## 11. Auditoría

- Toda acción crítica debe quedar registrada.
- El historial nunca debe borrarse automáticamente.
- Toda modificación importante debe guardar:
  - Usuario.
  - Fecha.
  - Hora.
  - Tienda.
  - Valor anterior.
  - Valor nuevo.
- El sistema debe permitir rastrear movimientos sospechosos.
- El sistema debe permitir detectar diferencias recurrentes por usuario o tienda.

## Envases retornables

- Todo envase retornable debe manejarse como inventario separado del producto.
- El importe del envase no debe confundirse con el precio del producto.
- Si se cobra importe, debe reflejarse en el total de venta.
- Si se devuelve envase y se entrega dinero, debe afectar caja.
- Si se presta envase sin importe, debe quedar registrado con cliente/persona.
- Todo préstamo de envase debe tener estado.
- Todo movimiento de envase debe quedar en historial.
- El sistema debe permitir detectar envases faltantes.
- El sistema debe permitir consultar importe pendiente por envases prestados.