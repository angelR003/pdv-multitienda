# Modelo de datos local y sincronización futura

La PWA usa IndexedDB en el teléfono. La aplicación de escritorio conserva SQLite.
No se copian ni se mezclan archivos de base de datos: la sincronización futura
intercambiará registros y operaciones mediante una API.

## Compatibilidad lógica

- Los 34 almacenes de negocio conservan los nombres de las tablas de `pdv.sqlite`.
- `id` es un UUID global en el móvil; `legacy_id` puede guardar el ID entero de
  SQLite cuando el servidor realice la primera vinculación.
- Las relaciones móviles usan los UUID de los registros relacionados.
- Los campos propios de cada dominio conservan los nombres actuales siempre que
  no comprometan el funcionamiento offline.

Todos los registros móviles añaden:

- `created_at` y `updated_at` en ISO 8601 UTC.
- `deleted_at` para borrado lógico.
- `version` para detectar ediciones concurrentes.
- `origin_device_id` para conocer la terminal de origen.
- `sync_status`: `pending`, `synced`, `conflict` o `demo`.
- `is_demo` para impedir que los registros ilustrativos lleguen al servidor.

## Protocolo previsto

Cada escritura real genera en `_outbox` una operación con `operation_id` UUID.
El servidor deberá guardar ese identificador y responder siempre lo mismo si lo
recibe de nuevo. Así se evitan ventas, abonos o movimientos duplicados después de
una interrupción de red.

La sincronización será por lotes:

1. El teléfono envía operaciones pendientes en orden de creación.
2. El servidor valida reglas y aplica cada `operation_id` una sola vez.
3. El servidor devuelve las nuevas versiones y los cambios de otros dispositivos.
4. La PWA marca operaciones como sincronizadas o registra el conflicto.

Ventas, pagos, movimientos, abonos y auditoría deben tratarse como hechos
inmutables. Inventario y saldos se calculan a partir de movimientos. Catálogos
como productos, precios y usuarios se resuelven mediante versión autorizada y
borrado lógico, nunca reemplazando bases completas.
