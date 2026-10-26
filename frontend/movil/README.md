# PWA móvil · interfaz instalable

Aplicación web progresiva de PDV Las Gardenias. Esta etapa incluye instalación,
funcionamiento sin conexión, configuración de terminal y una base operativa local
en IndexedDB. No usa API, autenticación ni base de datos remota.

## Abrir localmente

Desde la raíz del proyecto:

```powershell
python -m http.server 8080 --directory frontend/movil
```

Después visita:

```text
http://localhost:8080/login.html
```

`login.html` inicia el recorrido, `dashboard.html` es el menú
principal e `index.html` conserva la pantalla de venta.

## Instalación y almacenamiento

- `manifest.webmanifest` define nombre, colores, accesos rápidos e iconos.
- `service-worker.js` almacena la interfaz para poder abrirla sin conexión.
- `db.js` crea 34 almacenes de dominio equivalentes al esquema SQLite, además de
  metadatos, bandeja de sincronización y registro de conflictos.
- `business-rules.js` concentra las validaciones puras compartidas que aplicarán
  los módulos móviles. El contrato funcional está en
  [`docs/REGLAS-NEGOCIO-PWA.md`](../../docs/REGLAS-NEGOCIO-PWA.md).
- Cada registro móvil utiliza UUID, versión, dispositivo de origen, borrado lógico
  y estado de sincronización; `legacy_id` queda reservado para relacionarlo con
  los identificadores numéricos existentes en SQLite.
- La configuración de terminal se guarda en `localStorage` y también en los
  metadatos de IndexedDB, dentro del espacio privado de cada dispositivo.
- La pantalla de configuración permite solicitar almacenamiento persistente y
  exportar un respaldo JSON de esta instalación.
- La base SQLite real de la computadora nunca se incluye en los archivos públicos.
- Los registros operativos siguen siendo datos ilustrativos y sus acciones
  permanecen deshabilitadas hasta la etapa de lógica de negocio.

## Publicación

El flujo `.github/workflows/mobile-pages.yml` publica únicamente esta PWA
y el logotipo compartido en GitHub Pages. La URL raíz redirige al acceso de
la aplicación; no se publica el backend ni la base de datos.

