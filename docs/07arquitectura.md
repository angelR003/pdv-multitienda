# Arquitectura del sistema

## 1. Objetivo técnico

Construir un sistema PDV multi-tienda para controlar ventas, inventario, traspasos, caducidades, envases retornables, cortes de caja y auditoría de movimientos.

El sistema debe iniciar como una aplicación local funcional, pero estar preparado para sincronización futura entre tiendas.

---

## 2. Stack tecnológico

El sistema se desarrollará con:

- JavaScript.
- Node.js.
- Express.
- SQLite.
- HTML.
- CSS.
- JavaScript en frontend.

Motivo:

- JavaScript es más familiar para el desarrollador.
- Node.js permite construir backend local.
- SQLite es ligera y funciona bien en computadoras sencillas.
- Express permite crear una API clara.
- HTML/CSS/JS permite usar el sistema desde navegador.

---

## 3. Tipo de aplicación

El sistema será una aplicación web local.

Esto significa:

- El backend corre en la computadora de la tienda.
- El usuario abre el sistema desde el navegador.
- La base de datos se guarda localmente.
- No se necesita internet para vender localmente.

Ejemplo:

```text
http://localhost:3000