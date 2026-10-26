# Reglas de negocio compartidas · versión 1

Este documento es el contrato funcional para la aplicación de escritorio con
SQLite y la PWA con IndexedDB. Las dos implementaciones deben producir el mismo
resultado con los mismos datos. La sincronización transportará operaciones; no
mezclará archivos de base de datos.

## Principios generales

1. Toda operación compuesta es atómica: o se guardan cabecera, detalles,
   inventario, caja y auditoría, o no se guarda nada.
2. Ventas, pagos, entradas, devoluciones, traspasos, abonos y movimientos de
   caja son hechos históricos. No se editan ni eliminan; se corrigen con una
   operación compensatoria.
3. Cada operación real tiene `operation_id` UUID. Repetir el mismo ID y payload
   devuelve el resultado previo; reutilizarlo con datos distintos se rechaza.
4. Los importes se redondean a centavos. Las cantidades conservan su precisión;
   se usa tolerancia `1e-9` únicamente al compararlas.
5. No se permite inventario negativo.
6. Los registros se desactivan o se borran lógicamente. El historial nunca
   pierde sus referencias aunque el catálogo deje de estar activo.

## Productos y precios

- Tipo, nombre, unidad y precio global son obligatorios.
- Tipos permitidos: código de barras, peso variable y manual.
- El código es obligatorio para productos de código de barras y debe ser único.
- Un producto retornable debe indicar tipo de envase.
- El precio especial activo de la tienda reemplaza al precio global.
- Productos normales admiten cantidades enteras; peso variable y derivados
  admiten decimales.
- Un producto derivado descuenta inventario exclusivamente de su padre usando
  `cantidad × factor_conversion`.
- Las entradas y ajustes se registran sobre el producto físico padre, no sobre
  el derivado.
- Padre y factor de un derivado no cambian después de tener historial. Se debe
  desactivar y crear otro producto.

## Inventario, entradas y ajustes

- La existencia se mantiene por tienda y producto físico.
- Una venta o traspaso se rechaza si la suma agrupada requerida supera el saldo.
- Entrada: cantidad positiva; aumenta inventario en la misma transacción.
- Ajuste: solo administrador, cantidad final no negativa, motivo obligatorio y
  registro de cantidad anterior, nueva y diferencia.
- Mínimo y máximo no pueden ser negativos; el mínimo no supera al máximo.
- Inventario bajo significa `cantidad_actual <= cantidad_minima` cuando el
  mínimo es mayor que cero.

## Promociones

- Solo aplican promociones activas de un producto activo.
- Cantidad requerida entera, mínimo 2; precio promocional mayor que cero.
- No puede existir otra promoción activa para el mismo producto y cantidad.
- No aplican a peso variable ni a productos derivados.
- Si coinciden varias promociones, se elige la combinación que produzca el
  total más bajo; las unidades restantes usan precio normal.

## Ventas y pagos

- La venta exige tienda, usuario, forma de pago y al menos un producto o servicio.
- El precio y la promoción se vuelven a calcular al confirmar; nunca se confía
  en el total enviado por la pantalla.
- Estados: `completada`, `devuelta_parcial`, `devuelta_total` y `cancelada`.
- Métodos: efectivo, transferencia, fiado o mixto.
- En pago mixto ningún componente es negativo y la suma debe coincidir con el
  total con tolerancia de un centavo.
- Cualquier porción fiada exige cliente activo.
- Recargas y servicios son renglones históricos separados; la regla actual de
  escritorio cobra comisión fija de $1 a recargas. Debe volverse configurable
  antes de considerarse definitiva.
- Un producto retornable exige exactamente un escenario por unidad:
  `trajo_envase`, `dejo_importe` o `envase_prestado`.

## Fiados

- El saldo neto es `fiados - abonos`; un resultado negativo es saldo a favor.
- Un abono que genera saldo a favor requiere confirmación explícita.
- El abono y su movimiento de caja se guardan atómicamente y con `operation_id`.
- Un cliente con deuda, saldo a favor o envases pendientes no puede desactivarse.
- Regla propuesta para cerrar un hueco del sistema actual: el límite de crédito
  debe cumplirse usando saldo sincronizado más operaciones locales pendientes.
  Solo un administrador puede autorizar una excepción, que queda auditada.

## Devoluciones

- Solo se devuelve contra una venta registrada y con motivo obligatorio.
- La cantidad máxima es `vendida - previamente devuelta`.
- Una devolución no puede aplicarse dos veces, aunque se reintente o concurran
  dos solicitudes.
- Productos que regresan a inventario restauran el producto físico correcto;
  los derivados restauran al padre.
- Servicios y recargas se devuelven completos y no modifican inventario.
- El estado de la venta cambia a parcial o total según el remanente.
- Una devolución total cancela los envases pendientes vinculados a esa venta.

## Traspasos

- Origen y destino son obligatorios y diferentes.
- Debe incluir al menos un producto con cantidad válida y saldo suficiente.
- Al enviar, se descuenta inmediatamente de origen y queda `enviado`.
- Solo un traspaso `enviado` puede recibirse o cancelarse.
- Recibir suma una sola vez al destino y cambia a `recibido`.
- Cancelar regresa una sola vez al origen y cambia a `cancelado`.
- Derivados conservan el producto comercial en el detalle, pero mueven la unidad
  física del padre.

## Caja y cortes

- Movimientos de caja son inmutables, positivos y clasificados como fondo,
  entrada, salida, pago a proveedor, retiro o ajuste.
- Un error se corrige con un movimiento opuesto que referencia al original.
- El corte es una fotografía de ventas, pagos, devoluciones, gastos y movimientos
  desde el corte anterior. Una vez confirmado no se edita.
- Los pagos mixtos se desglosan por método para caja y reportes.

## Usuarios y permisos propuestos

- Administrador: catálogos, precios, usuarios, promociones, límites, ajustes,
  reportes globales, devoluciones y excepciones de crédito.
- Empleado: ventas, consultas, entradas, movimientos ordinarios de caja, fiados
  dentro del límite y recepción de traspasos de su tienda.
- Ninguna operación confía en un `usuario_id` o `tienda_id` enviado libremente;
  se toman de la sesión y terminal activas.

## Reglas offline y sincronización

- La PWA calcula con su última versión sincronizada más todas sus operaciones
  locales pendientes.
- Una operación de dinero o inventario ya confirmada localmente no se sobrescribe.
- El servidor acepta cada `operation_id` una sola vez y devuelve la versión final.
- Catálogos usan control de versión. Un conflicto no resuelto se guarda en
  `_conflicts` y no se descarta silenciosamente.
- Datos marcados `is_demo` jamás se sincronizan.

## Decisiones adoptadas para comenzar

- Inventario negativo: bloqueado.
- Promociones de peso variable o derivados: bloqueadas.
- Límite de crédito: obligatorio; excepción solo administrativa y auditada.
- Devoluciones: sin plazo automático por ahora, siempre contra venta registrada.
- Venta en efectivo sin fondo/corte abierto: permitida por compatibilidad con el
  sistema actual. Se reevaluará al implementar turnos de caja.

