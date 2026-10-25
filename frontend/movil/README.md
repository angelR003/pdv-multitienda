# PWA móvil · interfaz instalable

Aplicación web progresiva de PDV Las Gardenias. Esta etapa incluye instalación,
funcionamiento sin conexión y configuración de terminal guardada localmente.
No usa API, autenticación ni base de datos remota.

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
- La configuración de terminal se guarda en `localStorage`, dentro del espacio
  privado que el navegador asigna a esta aplicación en cada dispositivo.
- Los registros operativos siguen siendo datos ilustrativos y sus acciones
  permanecen deshabilitadas hasta la etapa de lógica de negocio.

## Publicación

El flujo `.github/workflows/mobile-pages.yml` publica únicamente esta PWA
y el logotipo compartido en GitHub Pages. La URL raíz redirige al acceso de
la aplicación; no se publica el backend ni la base de datos.
