# Respaldos y migración de datos a la PWA

La PWA usa IndexedDB, el almacenamiento privado del navegador. La aplicación de escritorio conserva SQLite. Ambos formatos pueden convivir: el exportador convierte una copia lógica de SQLite al formato portable `.pdvbackup`, manteniendo identificadores y relaciones de forma determinista para facilitar la sincronización futura.

## Crear el archivo desde la computadora

Con el proyecto abierto en PowerShell:

```powershell
npm run export:pwa -- --out "$env:USERPROFILE\Downloads\pdv-escritorio.pdvbackup"
```

El comando toma por defecto `%APPDATA%\LasGardenias\data\pdv.sqlite`. Para seleccionar otra base:

```powershell
npm run export:pwa -- --db "C:\ruta\pdv.sqlite" --out "$env:USERPROFILE\Downloads\pdv-escritorio.pdvbackup"
```

La base SQLite se abre con `OPEN_READONLY`, se verifica con `PRAGMA quick_check` y nunca se copia al repositorio. Los hashes de contraseña se excluyen del respaldo; al implementar acceso real en móvil será necesario configurar credenciales específicas.

## Llevar los datos al teléfono

1. Copiar `pdv-escritorio.pdvbackup` al teléfono por cable, nube, correo o el medio elegido por el propietario.
2. Abrir la PWA y entrar a **Configuración de terminal**.
3. Pulsar **Importar o restaurar respaldo** y seleccionar el archivo.
4. Revisar el resumen de tiendas, productos, inventario, clientes, promociones y ventas.
5. Pulsar **Confirmar importación**.

Antes de reemplazar los datos, la PWA descarga automáticamente un respaldo del contenido anterior. La importación se ejecuta en una sola transacción de IndexedDB: si ocurre un error, no queda una mezcla parcial.

Después de importar SQLite, la PWA reinicia la preparación local. Se debe elegir una de las tiendas importadas, seleccionar **Venta y consulta** o **Solo consulta** y crear la primera contraseña local para un usuario administrador. Los hashes de contraseña de la computadora nunca forman parte del archivo de migración.

## Usuarios y permisos locales

- **Administrador:** acceso global, configuración del dispositivo, usuarios, promociones, reportes y operaciones sensibles.
- **Empleado:** operación cotidiana de la tienda que tiene asignada, sin administración global.
- **Solo consulta:** bloquea todas las escrituras independientemente del rol.
- **Venta y consulta:** permite las escrituras correspondientes al rol del usuario.

Las credenciales móviles se derivan con PBKDF2-SHA-256 y se almacenan separadas de los registros de usuarios. La sesión local expira después de ocho horas.

## Respaldar o restaurar el teléfono

En **Configuración de terminal**, **Crear respaldo** descarga un archivo `.pdvbackup`. Guárdalo en Archivos, Descargas, Google Drive, iCloud u otra ubicación controlada por el usuario. La PWA no puede escribir silenciosamente en cualquier carpeta del teléfono por las reglas de seguridad del navegador.

Actualizar la PWA no elimina IndexedDB. Desinstalarla, borrar los datos del sitio o usar herramientas de limpieza sí puede hacerlo, por lo que conviene generar respaldos periódicos.

## Alcance actual

- El archivo se procesa localmente en el navegador y no se envía a un servidor.
- Esta etapa reemplaza la base móvil completa; todavía no fusiona cambios de dos dispositivos.
- La sincronización bidireccional, resolución de conflictos y nube siguen siendo una etapa posterior.
