# Plan de desarrollo

## Objetivo actual

Construir la primera versión funcional del sistema PDV MultiTienda Familiar enfocada en:

- Productos.
- Inventario.
- Ventas.
- Productos por peso.
- Traspasos.
- Devoluciones.
- Cortes básicos.
- Envases retornables.
- Auditoría básica.

---

# Fase 1 - Preparación del proyecto

Objetivo:

Preparar entorno técnico y estructura base.

Tareas:

- Instalar Node.js.
- Configurar VS Code.
- Crear estructura de carpetas.
- Inicializar backend con npm.
- Instalar dependencias.
- Configurar servidor Express.
- Configurar SQLite.
- Configurar variables de entorno.
- Crear README.
- Crear documentación inicial.

Estado:

- En progreso.

---

# Fase 2 - Base de datos

Objetivo:

Construir estructura inicial SQLite.

Tareas:

- Crear schema.sql.
- Crear tablas.
- Crear relaciones.
- Crear índices importantes.
- Crear datos de prueba.
- Validar estructura inicial.

Tablas prioritarias:

- tiendas
- usuarios
- productos
- inventario
- ventas
- venta_detalles

Estado:

- Pendiente.

---

# Fase 3 - Backend inicial

Objetivo:

Levantar API funcional.

Tareas:

- Configurar Express.
- Crear conexión SQLite.
- Crear rutas API.
- Crear controladores.
- Crear servicios.
- Manejar errores.
- Validar datos.
- Implementar auditoría básica.

Rutas prioritarias:

- productos
- ventas
- inventario
- usuarios

Estado:

- Pendiente.

---

# Fase 4 - Frontend inicial

Objetivo:

Construir interfaz mínima funcional.

Pantallas prioritarias:

- Login.
- Venta.
- Productos.
- Inventario.

Objetivos:

- Venta rápida.
- Escaneo de código de barras.
- Suma automática.
- Interfaz simple.

Estado:

- Pendiente.

---

# Fase 5 - Ventas

Objetivo:

Implementar flujo completo de venta.

Funciones:

- Escaneo.
- Productos por peso.
- Total automático.
- Métodos de pago.
- Descuento de inventario.
- Historial.

Estado:

- Pendiente.

---

# Fase 6 - Inventario y operación

Objetivo:

Implementar operación diaria real.

Funciones:

- Entradas.
- Traspasos.
- Devoluciones.
- Mermas.
- Cortes.
- Caducidades.

Estado:

- Pendiente.

---

# Fase 7 - Envases retornables

Objetivo:

Controlar envases vacíos, préstamos y devoluciones.

Funciones:

- Tipos de envase.
- Inventario de envases vacíos.
- Cobro de importe.
- Devolución de envases.
- Préstamos.
- Reportes.

Estado:

- Pendiente.

---

# Fase 8 - Reportes y auditoría

Objetivo:

Detectar diferencias y movimientos sospechosos.

Funciones:

- Reportes de ventas.
- Diferencias de caja.
- Diferencias de inventario.
- Historial de movimientos.
- Auditoría básica.

Estado:

- Pendiente.

---

# Fase 9 - Sincronización futura

Objetivo:

Permitir sincronización entre tiendas.

Funciones futuras:

- Sincronización automática.
- Resolución de conflictos.
- Servidor central.
- Cambios remotos.
- Sincronización offline.

Estado:

- Futuro.

---

# Regla principal del proyecto

No intentar construir todo al mismo tiempo.

Primero:

- Funcional.
- Estable.
- Claro.

Después:

- Bonito.
- Avanzado.
- Automatizado.