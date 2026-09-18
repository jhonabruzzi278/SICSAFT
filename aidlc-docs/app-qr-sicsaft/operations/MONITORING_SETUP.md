# Monitoring Setup

> Reescrito 2026-09-17 — la versión anterior decía "no hay deployment activo" (cierto en
> 2026-07-30, ya no). Ver nota histórica en `../00_PROJECT_METADATA.md`.

## Por qué esto no es monitoring tradicional (APM/dashboards en la nube)

`app-qr-sicsaft` no corre en un servidor propio expuesto a internet — se sirve embebida dentro del
`.exe` de `sicsaft-core` en la red local del cliente (on-premise, DOC-028). No hay un backend
propio que loguear ni un endpoint público que un APM externo pudiera scrapear: los errores reales
del ecosistema (fallas de sincronización, rechazos de CORE, etc.) quedan en la capa de CIS/CORE,
no en la PWA en sí.

## Qué existe hoy como diagnóstico operativo

- **Consola técnica del `.exe`** (`sicsaft-core`, `ConsolaTecnica.tsx`): permite diagnosticar en la
  PC del cliente por qué un servicio no arrancó, sin abrir una terminal — es el mecanismo real de
  soporte de todo el ecosistema, incluida la PWA. Ver `sicsaft-core/README.md`.
- **Cola de sincronización local** (`src/lib/sync-queue.ts`): si la APP no puede llegar a CIS,
  encola localmente y reintenta — el estado de la cola es visible en la propia UI (pantalla 12 del
  flujo, DOC-001), no en un dashboard externo.
- **Auditoría del lado servidor**: toda operación que sí llega a CORE queda registrada en
  `auditoria` (consultable vía `GET /auditoria`, ver DOC-011) — es la fuente de verdad de qué pasó,
  no logs de la PWA en sí.
- **`global-error-handler.ts`**: captura errores no manejados del lado cliente (sin envío a un
  servicio externo de error tracking todavía — solo consola/UI local).

## Gaps conocidos

- Sin error tracking centralizado (Sentry o similar) para errores de la PWA en el dispositivo del
  operador — hoy solo se ven localmente si alguien mira la consola del navegador/PWA.
- Sin métricas de uso (cuántos escaneos, tasa de fallo de sync) agregadas en ningún dashboard —
  el CIP (`cip/`) agrega analítica patrimonial, pero no telemetría de la app cliente en sí.
