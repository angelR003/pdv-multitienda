# Reporte READ_ONLY de inventario derivado

- Fuente: `C:\Users\seyer\AppData\Roaming\LasGardenias\data\pdv.sqlite`
- Tamaño: `1,007,616` bytes
- Modificación del archivo: `2026-07-15 16:04:23 -06:00`
- SHA-256 antes y después: `360B1F1A9637F68C93C5F949C1836A3F657F2E3A17F4454DE303C9160CD03C25`
- Barreras: `sqlite3.OPEN_READONLY` y `PRAGMA query_only=ON`
- Cobertura: `11` pares derivados × `3` tiendas = `33` filas
- Resultado de integridad de la inspección: tamaño, fecha y hash sin cambios.

`NULL` en disponibilidad significa que no existe una fila de inventario del padre en esa tienda. El factor mostrado es el factor actual; para operaciones históricas previas a esta corrección debe considerarse inferido. `Revisar=1` se activa por fila padre ausente, saldo legacy hijo, actividad histórica cuyo factor no puede probarse, entrada/ajuste/devolución sobre hijo u otra anomalía cubierta por el reporte.

| Tienda | Padre | Derivado | Factor | Stock padre | Saldo legacy hijo | Disponibilidad | Entradas hijo | Última venta | Revisar |
|---|---|---|---:|---:|---:|---:|---:|---|---:|
| LAS GARDENIAS | Huevitos | Huevito | 0.01 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS 2 | Huevitos | Huevito | 0.01 | 0.07999999999999977 | 0 | 8 | 0 | 2026-07-14 21:48:28 | 1 |
| LOS ANGELES | Huevitos | Huevito | 0.01 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS | Link | Link Sueltos | 0.05 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS 2 | Link | Link Sueltos | 0.05 | 2 | 0 | 40 | 0 | NULL | 0 |
| LOS ANGELES | Link | Link Sueltos | 0.05 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS | Marlboro KRETEK | Cigarros sueltos clavo | 0.05 | 49.5 | 50 | 990 | 0 | 2026-07-10 23:03:12 | 1 |
| LAS GARDENIAS 2 | Marlboro KRETEK | Cigarros sueltos clavo | 0.05 | 49.40000000000001 | 50 | 988 | 0 | 2026-07-15 16:21:24 | 1 |
| LOS ANGELES | Marlboro KRETEK | Cigarros sueltos clavo | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS | PALLMALL ALASKA | Palmall Alaska | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS 2 | PALLMALL ALASKA | Palmall Alaska | 0.05 | 48.45000000000004 | 50 | 969 | 0 | 2026-07-14 00:26:24 | 1 |
| LOS ANGELES | PALLMALL ALASKA | Palmall Alaska | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS | Panera polvoroncitos | Polvoroncito | 0.05 | 49.75 | 50 | 995 | 0 | 2026-07-10 22:34:07 | 1 |
| LAS GARDENIAS 2 | Panera polvoroncitos | Polvoroncito | 0.05 | 48.85000000000001 | 50 | 977 | 0 | 2026-07-12 02:50:36 | 1 |
| LOS ANGELES | Panera polvoroncitos | Polvoroncito | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS | pañales Bebin Jumbo | Pañales jumbo sueltos | 0.025 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS 2 | pañales Bebin Jumbo | Pañales jumbo sueltos | 0.025 | 0.07499999999999993 | 99.99799999999999 | 3 | 99.99799999999999 | 2026-07-14 03:09:38 | 1 |
| LOS ANGELES | pañales Bebin Jumbo | Pañales jumbo sueltos | 0.025 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS | Raidolitos | Raidolitos sueltos | 0.2 | 50 | 50 | 250 | 0 | NULL | 1 |
| LAS GARDENIAS 2 | Raidolitos | Raidolitos sueltos | 0.2 | 45.399999999999956 | 50 | 227 | 0 | 2026-07-13 01:25:42 | 1 |
| LOS ANGELES | Raidolitos | Raidolitos sueltos | 0.2 | 50 | 50 | 250 | 0 | NULL | 1 |
| LAS GARDENIAS | Ruby | Ruby suelto | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS 2 | Ruby | Ruby suelto | 0.05 | 46.35000000000005 | 50 | 927 | 0 | 2026-07-15 03:05:12 | 1 |
| LOS ANGELES | Ruby | Ruby suelto | 0.05 | 50 | 50 | 1000 | 0 | NULL | 1 |
| LAS GARDENIAS | Saba buenas noches | Toallas sueltas | 0.125 | 50 | 0 | 400 | 0 | NULL | 0 |
| LAS GARDENIAS 2 | Saba buenas noches | Toallas sueltas | 0.125 | 48.625 | 0 | 389 | 0 | 2026-07-14 03:09:38 | 1 |
| LOS ANGELES | Saba buenas noches | Toallas sueltas | 0.125 | 50 | 0 | 400 | 0 | NULL | 0 |
| LAS GARDENIAS | Vaso plastico | Vaso plastico suelto | 0.02 | 49.94 | 50 | 2497 | 0 | 2026-07-10 19:31:25 | 1 |
| LAS GARDENIAS 2 | Vaso plastico | Vaso plastico suelto | 0.02 | 3.580000000000001 | 50 | 179 | 0 | 2026-07-15 17:33:33 | 1 |
| LOS ANGELES | Vaso plastico | Vaso plastico suelto | 0.02 | 50 | 50 | 2500 | 0 | NULL | 1 |
| LAS GARDENIAS | Xl3 xtra | xl3 xtra sueltos | 0.08333333333333333 | 0 | 0 | NULL | 0 | NULL | 1 |
| LAS GARDENIAS 2 | Xl3 xtra | xl3 xtra sueltos | 0.08333333333333333 | 1.9166666666666665 | 0 | 23 | 0 | 2026-07-04 19:20:20 | 1 |
| LOS ANGELES | Xl3 xtra | xl3 xtra sueltos | 0.08333333333333333 | 0 | 0 | NULL | 0 | NULL | 1 |

Este archivo es un snapshot de auditoría. No aplica ninguna reparación ni convierte saldos legacy.
