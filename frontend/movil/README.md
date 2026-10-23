# Prototipo móvil · etapa 1

Prototipo estático y navegable de PDV Las Gardenias. No usa API, autenticación,
base de datos, almacenamiento local ni funciones de instalación PWA.

## Abrir localmente

Desde la raíz del proyecto:

```powershell
python -m http.server 8080 --directory frontend/movil
```

Después visita:

```text
http://localhost:8080/login.html
```

`login.html` inicia el recorrido de demostración, `dashboard.html` es el menú
principal e `index.html` conserva la pantalla de venta.

## Publicación

El flujo `.github/workflows/mobile-pages.yml` publica únicamente este prototipo
y el logotipo compartido en GitHub Pages. La URL raíz redirige al acceso de
demostración; no se publica el backend ni la base de datos.
