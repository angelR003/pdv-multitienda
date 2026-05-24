# Requerimientos del sistema

## 1. Requerimientos generales

El sistema debe permitir administrar tres tiendas familiares desde una misma lógica de operación, controlando ventas, inventario, traspasos, caducidades, devoluciones, cortes de caja, precios y movimientos de productos.

El sistema debe ayudar a detectar pérdidas de dinero o producto mediante historial de movimientos, diferencias de inventario y control de usuarios.

El sistema debe funcionar aunque no haya internet, al menos para vender y registrar movimientos localmente.

El sistema debe estar preparado para sincronizar información entre tiendas cuando haya conexión disponible.

El sistema debe priorizar simplicidad, rapidez y facilidad de uso para evitar errores o evasión de registro por parte de los empleados.

---

## 2. Tiendas o sucursales

El sistema debe permitir registrar varias tiendas.

Cada tienda debe tener:

- Nombre.
- Ubicación o referencia.
- Estado activo/inactivo.

El inventario debe manejarse separado por tienda.

---

## 3. Usuarios y roles

El sistema debe permitir crear usuarios para administradores y empleados.

Cada usuario debe tener:

- Nombre.
- Usuario o clave de acceso.
- Contraseña.
- Rol.
- Tienda asignada.
- Estado activo/inactivo.

Roles iniciales:

- Administrador.
- Empleado.

El sistema debe registrar qué usuario realiza cada movimiento importante.

### Administrador

Puede:

- Registrar productos.
- Cambiar precios.
- Aprobar cambios de precio.
- Registrar tiendas.
- Crear usuarios.
- Ver reportes.
- Ver historial completo.
- Ver diferencias de caja.
- Ver diferencias de inventario.
- Registrar entradas.
- Registrar traspasos.
- Registrar mermas.
- Ajustar inventario.
- Realizar cortes.
- Consultar auditoría.

### Empleado

Puede:

- Registrar ventas.
- Registrar devoluciones.
- Consultar productos.
- Consultar inventario básico.
- Registrar gastos autorizados.
- Realizar cortes propios.
- Solicitar cambios de precio.

No puede:

- Borrar ventas.
- Modificar inventario manualmente.
- Cambiar precios oficiales directamente.
- Eliminar devoluciones.
- Modificar cortes anteriores.
- Alterar historial.
- Crear usuarios.
- Ver reportes administrativos completos.

---

## 4. Productos
## Productos por peso o venta variable

El sistema debe permitir vender productos que no tienen código de barras y cuyo precio depende del peso o cantidad capturada.

Ejemplos:

- Jamón.
- Salchicha.
- Queso.
- Azúcar.
- Huevo.
- Arroz.
- Otros productos a granel.

Tipos de venta variable:

- Por kilogramo.
- Por gramo.
- Por pieza.
- Por importe capturado.

Cada producto de peso variable debe tener:

- Nombre.
- Categoría.
- Unidad principal.
- Precio por kilogramo o unidad.
- Costo de compra.
- Estado activo/inactivo.
- Requiere caducidad, si aplica.

El sistema debe permitir agregar estos productos a una venta mediante búsqueda manual o botones rápidos.

Al vender un producto por peso, el usuario debe capturar:

- Producto.
- Peso o cantidad.
- Precio unitario aplicable.
- Subtotal calculado.

Ejemplo:

Jamón: $120/kg  
Peso capturado: 0.250 kg  
Subtotal: $30

El sistema debe permitir vender por importe cuando el cliente pida una cantidad en dinero.

Ejemplo:

Huevo: $45/kg  
Cliente pide: $10  
El sistema registra venta por importe de $10 y calcula el peso aproximado correspondiente.

Reglas:

- Los productos por peso pueden no tener código de barras.
- Los productos por peso deben poder venderse sin escáner.
- El inventario de productos por peso debe manejarse en kilogramos o unidades equivalentes.
- Al vender productos por peso, el inventario debe descontarse según el peso vendido.
- La integración directa con báscula digital queda como función futura.

El sistema debe permitir registrar productos.

Cada producto debe tener:

- Nombre.
- Código de barras obligatorio.
- Categoría.
- Marca.
- Presentación.
- Unidad de venta.
- Precio base global.
- Costo de compra.
- Estado activo/inactivo.

Ejemplo:

Producto: Pepsi 2L  
Categoría: Refrescos  
Marca: Pepsi  
Presentación: Botella 2 litros  
Unidad: Pieza

El código de barras será un dato crítico del sistema.

El sistema debe permitir buscar productos por:

- Código de barras.
- Nombre.
- Marca.
- Categoría.

El sistema debe estar preparado para capturar productos usando lector de código de barras desde la primera versión.

---

## 5. Precios

El sistema debe manejar un precio base global para cada producto.

El sistema debe permitir registrar precios especiales por tienda únicamente cuando sea necesario.

Regla de precio:

- Si el producto tiene precio especial activo en la tienda actual, se usará ese precio.
- Si el producto no tiene precio especial activo en la tienda actual, se usará el precio base global.

Solo los administradores pueden crear, modificar o eliminar precios oficiales.

Los empleados pueden solicitar cambios de precio, pero no aprobarlos directamente.

Cada cambio de precio debe quedar registrado en historial.

Cada precio especial por tienda debe guardar:

- Producto.
- Tienda.
- Precio especial.
- Fecha de inicio.
- Estado activo/inactivo.
- Usuario administrador que lo registró.
- Motivo u observación.

### Solicitudes de cambio de precio

El sistema debe permitir que un empleado registre una solicitud de cambio de precio cuando detecte que un producto cambió.

Cada solicitud debe guardar:

- Fecha y hora.
- Tienda.
- Usuario solicitante.
- Producto.
- Precio actual.
- Precio sugerido.
- Motivo.
- Estado.

Estados posibles:

- Pendiente.
- Aprobado.
- Rechazado.

Si el administrador aprueba la solicitud, el nuevo precio se aplicará al producto según corresponda.

El administrador debe poder elegir si el cambio aprobado aplica como:

- Precio base global.
- Precio especial para una tienda específica.

Cada cambio aprobado debe guardar:

- Producto.
- Precio anterior.
- Precio nuevo.
- Usuario que aprobó.
- Fecha y hora.
- Alcance del cambio.
- Motivo.

El sistema debe permitir cambios de precio remotos por parte del administrador cuando exista conexión.

Si una tienda no tiene conexión, usará el último precio sincronizado disponible.

Si no hay internet, el cambio remoto quedará pendiente hasta que la tienda sincronice.

---

## 6. Inventario por tienda

El sistema debe permitir consultar cuántas piezas existen de cada producto en cada tienda.

El inventario debe mostrar:

- Producto.
- Tienda.
- Existencia actual.
- Existencia mínima recomendada.
- Existencia máxima recomendada.
- Productos faltantes.
- Productos sobrantes.

El sistema debe permitir comparar existencias entre tiendas.

Ejemplo:

Pepsi 2L:
- Tienda 1: 30 piezas
- Tienda 2: 2 piezas
- Tienda 3: 18 piezas

El sistema debe sugerir movimientos entre tiendas cuando una tenga sobrante y otra tenga faltante.

El sistema debe permitir detectar diferencias entre inventario esperado e inventario físico.

---

## 7. Entradas de mercancía

El sistema debe permitir registrar entradas de producto cuando llegue mercancía de proveedores.

Cada entrada debe guardar:

- Fecha.
- Tienda destino.
- Producto.
- Cantidad.
- Costo.
- Proveedor.
- Usuario que registró.
- Observaciones.

Toda entrada debe afectar automáticamente el inventario de la tienda correspondiente.

---

## 8. Ventas

El sistema debe permitir registrar ventas.

Cada venta debe guardar:

- Fecha y hora.
- Tienda.
- Usuario/cajero.
- Productos vendidos.
- Cantidad.
- Precio aplicado.
- Total.
- Método de pago.
- Estado de la venta.

Métodos de pago iniciales:

- Efectivo.
- Transferencia.
- Fiado.
- Mixto.

Estados posibles:

- Completada.
- Cancelada.
- Devuelta parcialmente.
- Devuelta totalmente.

Al registrar una venta, el sistema debe descontar automáticamente el inventario de la tienda correspondiente.

Al vender un producto, el sistema debe calcular automáticamente el precio aplicable según la tienda:

1. Buscar si existe precio especial activo para esa tienda.
2. Si existe, usar precio especial.
3. Si no existe, usar precio base global.

Toda venta debe quedar registrada en historial.
El sistema debe permitir registrar ventas mediante escaneo de código de barras.

Al escanear un producto:

- El sistema debe buscar automáticamente el producto.
- Agregarlo a la venta actual.
- Aumentar cantidad si el producto ya existe en la venta.
- Actualizar subtotal y total automáticamente.

El flujo de venta debe requerir la menor cantidad posible de clics y pasos.

---

## 8.1 Devoluciones

El sistema debe permitir registrar devoluciones de productos de forma accesible para cualquier tipo de usuario.

Una devolución debe guardar:

- Fecha y hora.
- Tienda.
- Usuario que registró.
- Producto devuelto.
- Cantidad devuelta.
- Motivo de devolución.
- Estado del producto.
- Monto devuelto, si aplica.
- Método usado para devolver el dinero, si aplica.
- Observaciones.

Motivos iniciales:

- Producto equivocado.
- Producto dañado.
- Producto caducado.
- Cliente se arrepintió.
- Error de venta.
- Otro.

Estados del producto devuelto:

- Puede regresar a inventario.
- No puede regresar a inventario.
- Requiere revisión.

Reglas iniciales:

- Si el producto puede regresar a inventario, el sistema debe sumar la cantidad al inventario de la tienda.
- Si el producto no puede regresar a inventario, el sistema debe registrarlo como merma.
- Toda devolución debe quedar registrada en el historial.
- Ningún usuario debe poder borrar una devolución después de registrarla.

---

## 9. Traspasos entre tiendas

El sistema debe permitir mover productos de una tienda a otra.

Cada traspaso debe guardar:

- Fecha.
- Tienda origen.
- Tienda destino.
- Producto.
- Cantidad.
- Usuario que registra.
- Motivo.
- Estado del traspaso.

Estados posibles:

- Pendiente.
- Enviado.
- Recibido.
- Cancelado.

El inventario debe descontarse de la tienda origen y sumarse a la tienda destino cuando el traspaso sea confirmado.

---

## 10. Caducidades

El sistema debe permitir registrar fecha de caducidad para productos que lo requieran.

Cada lote con caducidad debe guardar:

- Producto.
- Tienda.
- Cantidad.
- Fecha de caducidad.
- Fecha de entrada.
- Proveedor.

El sistema debe mostrar productos:

- Caducados.
- Próximos a caducar.
- Sin fecha registrada.

El sistema debe permitir registrar merma por caducidad.

El sistema debe ayudar a detectar productos olvidados o acumulados en tiendas.

---

## 11. Mermas y pérdidas

El sistema debe permitir registrar productos perdidos, dañados, rotos, caducados o faltantes.

Cada merma debe guardar:

- Fecha.
- Tienda.
- Producto.
- Cantidad.
- Motivo.
- Usuario que registró.
- Observaciones.

Motivos iniciales:

- Caducado.
- Dañado.
- Roto.
- Faltante.
- Robo sospechado.
- Error de captura.
- Otro.

Toda merma debe afectar automáticamente el inventario.

---

## 12. Cortes de caja

El sistema debe permitir realizar cortes de caja por tienda y usuario.

Cada corte debe mostrar:

- Fecha.
- Tienda.
- Usuario.
- Total vendido en efectivo.
- Total vendido por transferencia.
- Total fiado.
- Gastos registrados.
- Devoluciones registradas.
- Dinero esperado en caja.
- Dinero contado físicamente.
- Diferencia: sobrante o faltante.

El sistema debe permitir guardar observaciones del corte.

El sistema debe permitir detectar diferencias frecuentes entre dinero esperado y dinero real.

---

## 13. Gastos y salidas de efectivo

El sistema debe permitir registrar gastos hechos con dinero de caja.

Cada gasto debe guardar:

- Fecha.
- Tienda.
- Usuario.
- Concepto.
- Monto.
- Observaciones.

Ejemplos:

- Pago a proveedor.
- Cambio entregado.
- Compra menor.
- Servicio.
- Otro.

---

## 14. Fiado

El sistema debe permitir registrar ventas fiadas.

Cada venta fiada debe guardar:

- Cliente.
- Fecha.
- Productos.
- Total.
- Abonos.
- Saldo pendiente.
- Estado.

Estados:

- Pendiente.
- Pagado.
- Cancelado.

El sistema debe permitir consultar quién debe y cuánto debe.

---

## 15. Reportes

El sistema debe generar reportes básicos:

- Inventario por tienda.
- Productos faltantes.
- Productos sobrantes.
- Productos próximos a caducar.
- Productos caducados.
- Ventas por día.
- Ventas por tienda.
- Ventas por usuario.
- Cortes de caja.
- Mermas.
- Traspasos.
- Fiado pendiente.
- Diferencias de inventario.
- Diferencias de caja.
- Historial de devoluciones.
- Historial de cambios de precio.
- Solicitudes de cambio de precio pendientes.

---

## 16. Seguridad y control

El sistema debe guardar quién hizo cada movimiento importante.

Debe quedar historial de:

- Ventas.
- Cancelaciones.
- Entradas.
- Traspasos.
- Mermas.
- Cortes.
- Cambios de precio.
- Solicitudes de cambio de precio.
- Ajustes de inventario.
- Devoluciones.

Los empleados no deben poder borrar información crítica sin permiso de administrador.

---

## 16.1 Auditoría y control de movimientos

El sistema debe registrar toda acción importante realizada por los usuarios.

Cada movimiento debe guardar:

- Usuario.
- Fecha y hora.
- Tienda.
- Tipo de acción.
- Producto afectado.
- Cantidad anterior.
- Cantidad nueva.
- Observaciones.

El sistema debe generar historial para auditoría.

Acciones críticas:

- Cancelar ventas.
- Modificar inventario.
- Registrar mermas.
- Registrar devoluciones.
- Ajustar cantidades manualmente.
- Modificar precios.
- Solicitar cambios de precio.
- Aprobar cambios de precio.
- Rechazar cambios de precio.
- Eliminar registros permitidos.

El sistema debe permitir detectar diferencias entre:

- Inventario esperado.
- Inventario físico.
- Dinero esperado.
- Dinero real en caja.

El sistema debe permitir identificar usuarios con diferencias frecuentes.

---

## 17. Funcionamiento sin internet

El sistema debe permitir seguir vendiendo aunque no haya internet.

Cada tienda debe guardar sus movimientos localmente.

Cuando vuelva la conexión, el sistema deberá poder sincronizar los movimientos pendientes.

El sistema debe seguir funcionando incluso si la tienda principal está apagada temporalmente.

Cuando una tienda trabaje sin conexión, debe usar la última información sincronizada disponible, incluyendo productos, precios e inventario local.

---

## 18. Copias de seguridad

El sistema debe permitir realizar copias de seguridad de la base de datos.

Las copias deben poder guardarse en:

- La misma computadora.
- Una memoria USB.
- Una carpeta externa.
- En la nube en una fase futura.

El sistema debe facilitar recuperación en caso de falla de computadora o pérdida de datos.

---

## 19. Alcance de la primera versión

La primera versión NO incluirá todo.

La primera versión debe enfocarse en:

- Registrar tiendas.
- Registrar usuarios con rol administrador o empleado.
- Registrar productos con código de barras obligatorio.
- Buscar productos por código de barras.
- Registrar precio base global.
- Registrar precios especiales por tienda.
- Registrar solicitudes de cambio de precio.
- Aprobar o rechazar cambios de precio.
- Registrar inventario por tienda.
- Registrar entradas.
- Registrar ventas simples.
- Registrar devoluciones.
- Registrar traspasos.
- Consultar faltantes y sobrantes.
- Consultar productos próximos a caducar.
- Registrar cortes básicos.
- Registrar mermas.
- Generar historial básico de movimientos.

---

## 20. Funciones para versiones futuras

Funciones que pueden agregarse después:

- Sincronización avanzada entre tiendas.
- App móvil.
- Lectores de código de barras avanzados.
- Tickets impresos.
- Facturación.
- Reportes gráficos.
- Alertas automáticas.
- Predicción de compras.
- Control de proveedores avanzado.
- Permisos más detallados.
- Alertas de robo sospechado.
- Dashboard administrativo avanzado.

## Envases retornables

El sistema debe permitir controlar envases retornables asociados a ciertos productos.

Ejemplos:

- Caguama.
- Cerveza chica retornable.
- Coca-Cola de vidrio.
- Refresco retornable grande.

Cada tipo de envase debe tener:

- Nombre.
- Importe o depósito.
- Estado activo/inactivo.
- Producto relacionado, si aplica.

El sistema debe permitir cobrar importe de envase al vender productos retornables.

El sistema debe permitir registrar devolución de envases.

Al devolver un envase, el sistema debe permitir:

- Devolver dinero al cliente.
- Descontar el importe en una compra.
- Registrar solo la entrada del envase sin devolver dinero, si aplica.

El sistema debe permitir registrar préstamo de envases sin cobrar importe.

Cada préstamo de envase debe guardar:

- Fecha.
- Tienda.
- Usuario que registró.
- Cliente o persona.
- Tipo de envase.
- Cantidad.
- Importe no cobrado.
- Observaciones.
- Estado.

Estados del préstamo:

- Pendiente.
- Devuelto.
- Perdido.
- Cancelado.

El sistema debe permitir consultar:

- Envases disponibles por tienda.
- Envases prestados.
- Envases pendientes de devolución.
- Importe pendiente por envases no devueltos.
- Diferencias entre envases esperados y envases físicos.

Todo movimiento de envase debe quedar registrado en historial.

## Movimientos de caja

El sistema debe permitir registrar entradas y salidas de dinero que no sean ventas.

Tipos de movimiento:

- Entrada de dinero.
- Salida de dinero.
- Pago a proveedor.
- Retiro de efectivo.
- Ajuste de caja.
- Fondo inicial.

Cada movimiento debe guardar:

- Fecha.
- Tienda.
- Usuario.
- Tipo de movimiento.
- Monto.
- Concepto.
- Observaciones.

Las entradas de dinero deben aumentar el dinero esperado en caja.

Las salidas de dinero deben disminuir el dinero esperado en caja.

Los pagos a proveedores deben disminuir el dinero esperado en caja.

Todo movimiento de caja debe quedar registrado en historial.