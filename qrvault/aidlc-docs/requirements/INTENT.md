# Project Intent

## High-Level Purpose
Desarrollar una Aplicación Web Progresiva (PWA) instalable en Android que use la cámara del dispositivo para escanear códigos QR de productos, valide cada código contra una base de datos local de inventario, y genere un reporte de escaneo (escaneados / encontrados / no encontrados). Sirve como demo/prueba de concepto de un sistema de verificación de inventario mediante QR.

## Business Objectives
- Demostrar que es viable reemplazar procesos manuales de conteo/verificación de inventario por un flujo de escaneo QR desde el navegador, sin desarrollar una app nativa.
- Validar detección correcta de productos "fuera de catálogo registrado" (los 5 productos P016–P020 que existen físicamente/como QR pero no están en la base de datos).
- Servir de base reutilizable (PWA instalable, offline-first) para un futuro sistema de inventario real.

## Success Metrics
Definidos explícitamente en el brief como casos de prueba (ver `story-artifacts/ACCEPTANCE_CRITERIA.md`):
- Escanear 15 productos registrados → 15 escaneados / 15 encontrados / 0 fuera de BD.
- Escanear 16 (15 registrados + 1 no registrado) → 16 / 15 / 1.
- Escanear los 20 → 20 / 15 / 5, listando exactamente P016–P020.

Los tres casos fueron verificados en esta sesión ejecutando la lógica real de la app (`handleDecodedCode` + `buildReport`) contra los 20 códigos del catálogo — resultado: los tres casos pasan exactamente como se especifica.

## Constraints
### Technical
- Debe correr como PWA (manifest + service worker) instalable en Android.
- Debe usar la cámara del dispositivo vía API del navegador (`getUserMedia`, encapsulado por `html5-qrcode`).
- Base de datos local (elegido: IndexedDB) con únicamente 15 de los 20 productos.
- Sin backend/servidor de aplicación — 100% cliente, servible como archivos estáticos.

### Business
- ⚠️ No documentado — no se mencionan stakeholders externos, presupuesto, ni fecha límite. Se asume que es un proyecto de demostración/aprendizaje de un único usuario/desarrollador (ver `STAKEHOLDERS.md`).
