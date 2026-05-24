# Flujos de trabajo

## 1. Flujo de venta normal

1. El empleado inicia sesión.
2. El sistema identifica la tienda asignada al usuario.
3. El empleado abre la pantalla de venta.
4. El empleado escanea el código de barras del producto.
5. El sistema busca el producto.
6. Si el producto existe:
   - Lo agrega a la venta.
   - Si ya estaba agregado, aumenta la cantidad.
   - Calcula el precio aplicable según la tienda.
   - Actualiza subtotal y total.
7. Si el producto no existe:
   - Muestra aviso de producto no encontrado.
   - Permite cancelar o reportar producto pendiente de registro.
8. El empleado repite el proceso con todos los productos.
9. El empleado selecciona método de pago:
   - Efectivo.
   - Transferencia.
   - Fiado.
   - Mixto.
10. El sistema calcula el total final.
11. El empleado confirma la venta.
12. El sistema guarda la venta.
13. El sistema descuenta inventario.
14. El sistema registra el movimiento en historial.

## 2. Flujo de devolución

1. El empleado inicia sesión.
2. El empleado abre la opción de devoluciones.
3. El empleado busca la venta original, si existe.
4. Si no se encuentra la venta original, el sistema permite registrar una devolución manual.
5. El empleado escanea o selecciona el producto devuelto.
6. El empleado indica la cantidad devuelta.
7. El empleado selecciona el motivo:
   - Producto equivocado.
   - Producto dañado.
   - Producto caducado.
   - Cliente se arrepintió.
   - Error de venta.
   - Otro.
8. El empleado selecciona el estado del producto:
   - Puede regresar a inventario.
   - No puede regresar a inventario.
   - Requiere revisión.
9. El sistema calcula el monto a devolver, si aplica.
10. El empleado confirma la devolución.
11. Si el producto puede regresar a inventario, el sistema suma la cantidad al inventario.
12. Si el producto no puede regresar a inventario, el sistema registra una merma.
13. El sistema registra la devolución en historial.
14. El sistema actualiza el estado de la venta si corresponde:
   - Devuelta parcialmente.
   - Devuelta totalmente.

---

## 3. Flujo de entrada de mercancía

1. El administrador inicia sesión.
2. Abre la opción de entradas de mercancía.
3. Selecciona la tienda destino.
4. Selecciona o escanea el producto.
5. El sistema muestra los datos del producto.
6. El administrador captura:
   - Cantidad recibida.
   - Costo de compra.
   - Proveedor.
   - Fecha de caducidad, si aplica.
   - Observaciones.
7. El administrador confirma la entrada.
8. El sistema suma la cantidad al inventario de la tienda destino.
9. Si el producto tiene fecha de caducidad, el sistema registra el lote.
10. El sistema guarda el movimiento en historial.

---

## 4. Flujo de traspaso entre tiendas

1. El administrador inicia sesión.
2. Abre la opción de traspasos.
3. Selecciona tienda origen.
4. Selecciona tienda destino.
5. Escanea o selecciona el producto.
6. Captura la cantidad a mover.
7. Captura el motivo del traspaso.
8. El sistema valida que la tienda origen tenga existencia suficiente.
9. El administrador confirma el traspaso.
10. El sistema crea el traspaso con estado “Enviado”.
11. El sistema descuenta el producto de la tienda origen.
12. Cuando la tienda destino recibe el producto, el usuario confirma recepción.
13. El sistema suma el producto al inventario de la tienda destino.
14. El sistema guarda todo el movimiento en historial.

---

## 5. Flujo de corte de caja

1. El empleado inicia sesión.
2. Abre la opción de corte de caja.
3. El sistema identifica tienda y usuario.
4. El sistema calcula:
   - Total vendido en efectivo.
   - Total vendido por transferencia.
   - Total fiado.
   - Gastos registrados.
   - Devoluciones registradas.
   - Dinero esperado en caja.
5. El empleado captura el dinero contado físicamente.
6. El sistema calcula la diferencia:
   - Sin diferencia.
   - Sobrante.
   - Faltante.
7. El empleado agrega observaciones, si aplica.
8. El empleado confirma el corte.
9. El sistema guarda el corte en historial.
10. El administrador puede consultar cortes por tienda, usuario y fecha.

---

## 6. Flujo de cambio de precio

### 6.1 Solicitud de cambio por empleado

1. El empleado inicia sesión.
2. Escanea o busca el producto.
3. El sistema muestra el precio actual.
4. El empleado selecciona “Solicitar cambio de precio”.
5. El empleado captura:
   - Precio sugerido.
   - Motivo.
   - Observaciones.
6. El sistema guarda la solicitud con estado “Pendiente”.
7. El administrador puede revisar la solicitud.

### 6.2 Aprobación por administrador

1. El administrador inicia sesión.
2. Abre solicitudes de cambio de precio.
3. Revisa producto, precio actual, precio sugerido y motivo.
4. El administrador decide:
   - Aprobar.
   - Rechazar.
5. Si aprueba, selecciona el alcance:
   - Precio base global.
   - Precio especial para una tienda.
6. El sistema actualiza el precio correspondiente.
7. El sistema guarda:
   - Precio anterior.
   - Precio nuevo.
   - Usuario que aprobó.
   - Fecha y hora.
   - Alcance.
   - Motivo.
8. Si rechaza, el sistema guarda la solicitud como rechazada.
9. Todo queda registrado en historial.

---

## 7. Flujo de merma

1. El usuario inicia sesión.
2. Abre la opción de mermas.
3. Escanea o selecciona el producto.
4. Captura la cantidad.
5. Selecciona motivo:
   - Caducado.
   - Dañado.
   - Roto.
   - Faltante.
   - Robo sospechado.
   - Error de captura.
   - Otro.
6. Agrega observaciones.
7. Confirma la merma.
8. El sistema descuenta el producto del inventario.
9. El sistema guarda el movimiento en historial.

---

## 8. Flujo sin internet

1. La tienda pierde conexión a internet.
2. El sistema sigue funcionando localmente.
3. El usuario puede:
   - Registrar ventas.
   - Registrar devoluciones.
   - Registrar gastos.
   - Registrar cortes.
   - Consultar productos ya sincronizados.
   - Usar precios previamente sincronizados.
4. El sistema marca los movimientos como pendientes de sincronización.
5. Cuando vuelve internet, el sistema intenta sincronizar.
6. El sistema envía movimientos pendientes.
7. El sistema recibe cambios nuevos:
   - Productos.
   - Precios.
   - Inventario.
   - Solicitudes aprobadas.
8. Si hay conflicto, el sistema lo marca para revisión administrativa.
9. El sistema muestra la última fecha y hora de sincronización.

## 9. Flujo de venta con envase retornable

1. El empleado escanea o selecciona un producto retornable.
2. El sistema detecta que el producto requiere envase.
3. El sistema agrega el producto a la venta.
4. El sistema agrega automáticamente el importe del envase, si aplica.
5. El empleado confirma si se cobrará importe de envase.
6. Si se cobra importe:
   - El total de la venta aumenta.
   - El sistema registra el envase como entregado al cliente.
7. Si no se cobra importe:
   - El sistema registra préstamo de envase.
   - El empleado debe capturar cliente/persona y observación.
8. Al finalizar la venta, el sistema descuenta el producto vendido.
9. El sistema registra el movimiento de envase en historial.

---

## 10. Flujo de devolución de envase

1. El empleado abre la opción de devolución de envase.
2. Selecciona o busca el tipo de envase.
3. Captura cantidad devuelta.
4. El sistema muestra el importe correspondiente.
5. El empleado selecciona qué hacer:
   - Devolver dinero.
   - Descontar en compra.
   - Registrar entrada sin devolución de dinero.
6. El sistema suma envases disponibles en tienda.
7. Si existía préstamo pendiente, el sistema permite marcarlo como devuelto.
8. El sistema registra el movimiento en historial.

---

## 11. Flujo de préstamo de envase

1. El empleado o administrador abre la opción de préstamo de envase.
2. Selecciona tipo de envase.
3. Captura cantidad.
4. Captura cliente/persona.
5. Captura observaciones.
6. El sistema registra el importe no cobrado.
7. El sistema marca el préstamo como pendiente.
8. El sistema descuenta envases disponibles.
9. El sistema guarda el movimiento en historial.