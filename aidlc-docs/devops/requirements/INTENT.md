# Intención — Instalador on-premise por cliente

## Qué se pide

Un cambio de modelo de despliegue: además del stack compartido en un VPS propio
(`devops/local/`/`devops/prod/`, multi-tenant por Organización dentro de una sola Base
Patrimonial), SICSAFT se vende también como **instalación aislada por cliente**, en el propio
PC/servidor del cliente, sin depender de un VPS del vendedor. El vendedor (administrador del
sistema) va presencial o se conecta remoto a instalar y configurar el sistema en cada sitio
cuando el cliente paga.

## Por qué ahora

Modelo de precios nuevo en 3 niveles de producto, confirmado con el usuario:

- **Nivel 1**: APP QR SICSAFT + SICSAFT (CIS + CORE) — captura vía QR, sin portal web.
- **Nivel 2**: Nivel 1 + portal(es) web (`ccp`, `web_admin`, `core/frontend` — los 3 roles).
- **Nivel 3**: Nivel 2 + RFID.

Este modelo de venta por instalación aislada es incompatible con la arquitectura actual, pensada
para un único VPS compartido — hace falta un paquete de despliegue nuevo, documentado antes de
construirse (`CLAUDE.md` — "Metodología AI-DLC para features nuevas").

## Qué NO es esta fase

- **No incluye Nivel 3 (RFID)**: `rfid/` está "No iniciado" en `ROADMAP.md` — no hay código que
  empaquetar todavía. Se documenta el gancho (dónde encajaría), no se implementa nada.
- **No es el instalador `.exe` empaquetado**: este incremento entrega el stack de contenedores
  parametrizado por nivel + el script de bootstrap de Zitadel, verificables a mano
  (`podman-compose up`). El empaquetado final (Inno Setup/NSIS, detección/instalación de
  WSL2+Podman) es un incremento posterior, una vez verificado el stack en una máquina Windows
  limpia real.
- **No es licenciamiento ni activación por cliente**: no hay DRM, no hay validación de licencia
  contra un servidor del vendedor, no hay expiración. Es pura instalación técnica — el control
  comercial (quién pagó, qué nivel tiene activo) lo gestiona el usuario fuera de este repo.
- **No cambia el modelo de `Contrato`/`base-patrimonial`**: no se agregan campos nuevos a esas
  tablas para representar "nivel de producto" — ver `design-artifacts/DOC-025-niveles-producto-onprem.md`
  para dónde vive esa distinción (a nivel de despliegue, no de dato).
- **No decide `cip/` (BI)**: el usuario no mencionó CIP en ningún nivel de precios. Queda fuera de
  los 3 niveles como pregunta abierta, no se asume que el cliente lo necesita.

## Resultado esperado

Un admin puede clonar `devops/onprem/`, completar un `.env` con datos de un cliente nuevo, correr
`bootstrap-zitadel.ps1` y `podman-compose --profile nivelX up -d --build`, y terminar con un
stack SICSAFT aislado, funcionando de punta a punta (login OIDC real, APP QR sincronizando,
portales operando según el nivel contratado) sin tocar el dashboard de Zitadel a mano.
