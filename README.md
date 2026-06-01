# PDV Las Gardenias

Sistema de punto de venta multitienda para operacion local, inventario, ventas, traspasos, fiados, envases retornables y reportes operativos.

Este proyecto nacio para resolver una necesidad real: administrar tiendas familiares sin depender de internet, sin hojas sueltas, sin calculos a mano y sin perder control sobre lo que entra, sale, se presta, se cobra o se mueve entre sucursales.

## Vision

PDV Las Gardenias busca ser un sistema ligero, local y confiable para tiendas de abarrotes, minisuper o negocios familiares con mas de una sucursal.

La prioridad no es verse como un demo bonito, sino funcionar en el mostrador: rapido para vender, claro para inventariar, estricto con el dinero, cuidadoso con los productos derivados y preparado para crecer hacia sincronizacion entre tiendas.

## Estado Actual

Version: `1.1.9`

El sistema ya cuenta con modulos funcionales para:

- Ventas por codigo de barras.
- Productos a granel.
- Productos manuales y productos derivados.
- Inventario por tienda.
- Entradas de mercancia.
- Ajustes de inventario.
- Traspasos entre tiendas.
- Notificaciones de traspasos pendientes.
- Fiados, clientes, deudas y abonos.
- Envases retornables, importes y envases prestados.
- Promociones por cantidad.
- Devoluciones.
- Cortes y movimientos de caja.
- Usuarios por rol.
- Reportes con graficas locales.
- Backups locales de la base de datos.
- Aplicacion de escritorio con Electron.

## Modulos Principales

### Dashboard

Panel principal de operacion. Muestra la sesion activa, accesos a modulos y notificaciones de traspasos. El dashboard separa funcionalidades por rol para que un empleado no vea herramientas administrativas que no le corresponden.

### Ventas

Pantalla de venta rapida para operacion diaria.

Incluye:

- Escaneo por codigo de barras.
- Agregar productos a granel.
- Agregar productos sueltos o derivados.
- Calculo de total y cambio.
- Pago en efectivo, tarjeta o fiado.
- Validacion de stock antes de cobrar.
- Bloqueo contra doble cobro accidental.
- Manejo de productos retornables.
- Registro automatico de envases e importes cuando aplica.

### Productos

Modulo para crear y administrar productos.

Permite:

- Productos con codigo de barras.
- Productos a granel.
- Productos manuales.
- Productos derivados, como cigarros sueltos desde una cajetilla.
- Productos retornables ligados a tipos de envase.
- Edicion, activacion y desactivacion.
- Busqueda por nombre, codigo, categoria o marca.

### Inventario

Control de existencias por tienda.

El inventario entiende productos normales y productos derivados. Por ejemplo, si una cajetilla tiene 20 cigarros y se venden 13 sueltos, la existencia se muestra de forma humana, no como un decimal confuso.

Ejemplo:

```text
0 cajetillas + 7 piezas
1 cajetilla + 5 piezas
```

Esto evita errores peligrosos como creer que queda una cajetilla completa cuando en realidad solo quedan piezas sueltas.

### Entradas de Mercancia

Registro de mercancia nueva al inventario.

Para productos con derivados, el sistema permite capturar paquetes cerrados y piezas sueltas por separado. Por ejemplo:

```text
1 cajetilla cerrada
5 piezas sueltas
```

Internamente se guarda con precision, pero el usuario no necesita pensar en decimales.

### Ajustes de Inventario

Correcciones manuales de existencias.

Sirve para conteos fisicos, diferencias, producto roto, merma o correcciones operativas. Al igual que entradas, permite ajustar productos derivados usando paquetes cerrados y piezas sueltas.

### Traspasos

Modulo para mover mercancia entre tiendas.

Flujo general:

1. Un administrador crea el traspaso.
2. El inventario se descuenta de la tienda origen.
3. La tienda destino recibe una notificacion.
4. El responsable revisa el detalle del traspaso.
5. Al confirmar recepcion, el inventario aumenta en la tienda destino.

Incluye:

- Traspasos entre sucursales.
- Detalle de productos enviados.
- Recepcion por la tienda destino.
- Cancelacion cuando aplica.
- Notificaciones en el dashboard.
- Acceso controlado por rol.

### Fiados

Control de clientes deudores.

Incluye:

- Crear clientes.
- Registrar deudas.
- Registrar abonos.
- Ver historial.
- Controlar limite de credito.
- Integracion con ventas fiadas.
- Integracion con envases prestados.

### Importes y Envases Retornables

Modulo para manejar escenarios comunes de tiendas con envases:

- El cliente trae envase.
- El cliente deja importe.
- El cliente se lleva envase prestado.

El sistema registra pendientes, importes, envases vacios y deudas asociadas cuando corresponde.

### Promociones

Promociones por cantidad para productos completos.

Ejemplo:

```text
3 piezas por $25.00
```

El sistema conserva precio original, precio final, cantidad promocionada y descuento aplicado para reportes e historial.

### Reportes

Panel de analisis operativo con graficas locales, sin depender de CDN ni internet.

Incluye:

- Ventas totales.
- Numero de ventas.
- Ticket promedio.
- Devoluciones.
- Ventas por dia.
- Metodos de pago.
- Productos mas vendidos.
- Promociones usadas.
- Inventario bajo.
- Fiados pendientes.

### Usuarios y Roles

El sistema diferencia permisos entre administradores y empleados.

Un administrador puede gestionar configuracion, usuarios, reportes y traspasos. Un empleado puede operar ventas y recibir traspasos cuando corresponda.

### Backups

El backend genera respaldos locales de la base de datos para reducir riesgo de perdida accidental durante la operacion o actualizaciones.

## Arquitectura

El sistema esta construido como una aplicacion de escritorio con frontend local y backend Node.js.

```text
PDV-Multitienda
|
|-- frontend/              Pantallas HTML, CSS y JavaScript
|-- backend/
|   |-- src/
|   |   |-- app.js          Servidor Express
|   |   |-- controllers/    Logica de negocio
|   |   |-- routes/         Rutas API
|   |   |-- database/       Conexion, migraciones y utilidades SQLite
|   |   |-- middlewares/    Autenticacion y roles
|   |   |-- utils/          Backups y utilidades
|
|-- main.js                Entrada Electron
|-- preload.js             Puente seguro Electron
|-- package.json           Scripts, build y configuracion de app
```

## Stack Tecnico

- JavaScript
- Node.js
- Express
- SQLite
- Electron
- Tailwind CSS local
- HTML y JavaScript vanilla en frontend
- JWT para autenticacion
- bcrypt para contrasenas
- electron-builder para instaladores

## Principios del Proyecto

- Offline primero.
- Rapido en mostrador.
- Sin depender de estilos o librerias externas por CDN.
- Base local con SQLite.
- Control por tienda.
- Interfaces simples para personal no tecnico.
- Validaciones fuertes en backend.
- Operacion real antes que arquitectura innecesaria.

## Instalacion de Desarrollo

Instalar dependencias del proyecto principal:

```powershell
npm install
```

Instalar dependencias del backend:

```powershell
cd backend
npm install
```

Iniciar backend en desarrollo:

```powershell
cd backend
npm run dev
```

Abrir la app de escritorio:

```powershell
npm run electron
```

Compilar CSS local:

```powershell
npm run build:css
```

Construir instalador:

```powershell
npm run build
```

## Base de Datos

La aplicacion usa SQLite local. En Windows, la base operativa se guarda en la carpeta de datos de la aplicacion:

```text
C:\Users\<usuario>\AppData\Roaming\LasGardenias\data\pdv.sqlite
```

El sistema ejecuta migraciones al iniciar para preparar tablas y columnas necesarias.

## Rutas API

El backend expone rutas agrupadas por modulo:

```text
/api/auth
/api/productos
/api/ventas
/api/inventario
/api/precios
/api/cortes
/api/entradas
/api/movimientos-caja
/api/ajustes-inventario
/api/devoluciones
/api/backups
/api/usuarios
/api/importes
/api/fiados
/api/promociones
/api/traspasos
/api/reportes
```

## Pantallas

Pantallas principales disponibles en `frontend/`:

```text
login.html
config-terminal.html
dashboard.html
index.html
productos.html
inventario.html
entradas.html
ajustes-inventario.html
ventas-historial.html
venta-detalle.html
cortes.html
movimientos-caja.html
fiados.html
importes.html
promociones.html
traspasos.html
traspaso-detalle.html
reportes.html
usuarios.html
```

## Flujo Operativo Recomendado

1. Configurar tienda/terminal.
2. Crear usuarios.
3. Registrar productos.
4. Registrar entradas iniciales de inventario.
5. Operar ventas diarias.
6. Registrar devoluciones, fiados o envases cuando aplique.
7. Usar traspasos para mover mercancia entre tiendas.
8. Revisar reportes y cortes.
9. Respaldar la base antes de actualizaciones importantes.

## Roadmap

Siguientes pasos naturales del proyecto:

- Sincronizacion entre tiendas.
- Resolucion de conflictos de inventario entre sucursales.
- Historial avanzado por producto.
- Alertas mas inteligentes de inventario bajo.
- Reportes exportables.
- Mejoras de auditoria para cambios sensibles.
- Pruebas automatizadas de flujos criticos.

## Filosofia

Este PDV esta hecho para una tienda real, con problemas reales:

- Clientes que dejan importe.
- Envases que regresan despues.
- Cigarros que se venden sueltos.
- Mercancia que se mueve entre sucursales.
- Empleados que necesitan operar sin ver todo.
- Administradores que necesitan saber que esta pasando.

No es solo una caja registradora. Es el centro de control de Las Gardenias.

