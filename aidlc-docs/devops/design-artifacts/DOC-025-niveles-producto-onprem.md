# DOC-025 — Niveles de producto (instalación on-premise por cliente)

Documento citable desde otros DOC-XXX del repo, mismo esquema que DOC-002/004/005. Ver
`../requirements/INTENT.md` para el contexto de negocio completo.

> **Revisión 2026-08-25**: redefinición de qué portal entra en cada nivel, a pedido explícito del
> cliente de negocio. Reemplaza la versión anterior de este documento (Nivel 1 sin portal web,
> los 3 portales juntos recién en Nivel 2) — ver historial de git para la versión previa si hace
> falta reconstruir una instalación vieja.
>
> **Historia (2026-08-28 → 2026-09-02)**: el camino `sicsaft-core.exe` (CORE-RF-04) empezó como
> una **excepción** — embebía `ccp` completo en todos los niveles porque el "web-aft" liviano de
> Nivel 1 nunca tuvo código y `ccp` ya existía probado de punta a punta. El 2026-09-02 esa
> excepción se generalizó: **`devops/onprem/` adoptó el mismo modelo** (ver §1.1). El "web-aft"
> queda descartado; en los dos caminos de instalación el `ccp` completo va desde Nivel 1 y ningún
> servicio está gateado por perfil de Compose.
>
> **Ampliación 2026-08-31/09-02 (`sicsaft-core.exe`)**:
> [DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-A le puso al
> `ccp` un flag `VITE_SICSAFT_NIVEL` que en `1` **oculta el módulo Dashboard/indicadores (CIP)** —
> el resto del CCP va completo en todos los niveles (corrección 2026-09-02) — y
> [DOC-030](../../sicsaft-core/design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md)
> hace que el vendedor elija **Nivel 1 o Nivel 2** en el wizard (persistido en `instalacion.json`,
> inyectado al servir el portal). Así el `.exe` cubre los dos niveles con el mismo binario. Lo que
> **no** entra al `.exe` en ningún nivel es **`web_admin/`** (portal Administración del Sistema) ni
> ningún portal de administración remota: la instalación de escritorio es autocontenida, sin
> canal de conexión del proveedor al cliente (por eso la Fase F de DOC-028 quedó descartada). En
> ese camino, "administración web" de Nivel 2 se cubre con lo que crea el wizard + el portal
> Directivo ("designar Profesional de AFT") + el módulo Estructura del CCP; cambios de
> sedes/contrato son una operación asistida del proveedor, no un portal en la PC del cliente. El
> modelo de perfiles Compose de `devops/onprem/` (que sí incluye `web_admin` desde Nivel 1) no
> cambia.

## 1. Los 3 niveles (modelo de precios del usuario)

> **Nomenclatura vigente** ([NOMENCLATURA.md 4](../../../NOMENCLATURA.md)): Nivel 1 = **Modo
> Básico**, Nivel 2 = **Modo Profesional**, Nivel 3 = **Modo Enterprise**. "Base Patrimonial
> Central" → **BPI**. **CIP entra en Nivel 2** (2026-09-02, ver la nota de INST-Q-01 más abajo).

| Nivel / Modo | Qué incluye | Servicios concretos del monorepo |
|---|---|---|
| **Nivel 1 — Modo Básico** | APP SICSAFT (QR, única fuente de captura) + SICSAFT CORE + BPI + CIS + portal Directivo + portal Administrador del Sistema + **CCP completo** (operación, administración, control — gestión avanzada incluida; sin el Dashboard/indicadores, que es CIP) | `postgres`, `keycloak` (ADR-004 Fase 3, reemplaza a `zitadel`), `core` (con `core-migrate`), `cis`, `app-qr-sicsaft`, `core-frontend` (Directivo), `web-admin` (Administrador del Sistema), `ccp` — sin `redis` desde [ADR-005](../../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md) |
| **Nivel 2 — Modo Profesional** | Nivel 1 + **CIP** (Dashboard/indicadores/alertas). El CCP ya va completo en Nivel 1 (corrección 2026-09-02). | Nivel 1 + `cip` (con `cip-migrate`) |
| **Nivel 3 — Modo Enterprise** | Nivel 2 + integración RFID, conectada a CIS preservando la independencia tecnológica de CORE | Nivel 2 + `rfid/` — **🔲 no iniciado, sin código que empaquetar (ver `ROADMAP.md`)** |

Capacidades por nivel (lo que el cliente ve, no la lista de servicios):

- **Nivel 1 — Modo Básico**: identificación, consulta, inventarios, incidencias, historial,
  trazabilidad básica **+ el CCP completo** (activos con alta/edición/baja, estructura,
  importaciones, QR/Etiquetas, auditoría). Solo el **Dashboard** queda oculto por el flag
  `VITE_SICSAFT_NIVEL` (DOC-029 RF-A, corrección 2026-09-02) — es CIP, no CCP.
- **Nivel 2 — Modo Profesional** (suma): **reportes/indicadores/alertas (CIP)** — el Dashboard
  ejecutivo del CCP y lo que venga de `cip/`.
- **Nivel 3 — Modo Enterprise** (suma): captura automática, eventos RFID, supervisión, zonas,
  movimientos, alertas, automatización patrimonial.

### Portal de Profesional de AFT: una sola pieza, `ccp/`, en todos los niveles

> **Corrección 2026-09-02** (unifica con `sicsaft-core.exe`): esta sección describía **dos
> aplicaciones distintas** — un "web-aft" liviano de Nivel 1 (nunca construido) y `ccp/` completo
> recién en Nivel 2. Queda **revertido**: el Profesional de AFT usa el **mismo `ccp/` completo en
> todos los niveles**. Lo único que Nivel 2 agrega es el módulo **Dashboard/indicadores**, que
> consume el **CIP**, no el CCP (CCP ≠ CIP, Tomo IV).

- **`ccp/`** (Centro de Control Patrimonial) — el portal del Profesional de AFT, ya implementado,
  con toda su gestión avanzada (alta de activos, Estructura, importaciones, QR/Etiquetas,
  auditoría). Va **completo desde Nivel 1**. No hay ni habrá un "web-aft" liviano aparte.
- El nivel contratado se hornea en el build de `ccp` como `VITE_SICSAFT_NIVEL` (`1` | `2`): en `1`
  oculta el módulo **Dashboard** (único consumidor del CIP), en `2` lo muestra. Es la única
  diferencia de UI entre niveles. `ccp/src/lib/nivel.ts` `MODULOS_CIP`.

Directivo (`core/frontend`) y Administrador del Sistema (`web_admin`) tampoco tienen versión
liviana: el mismo portal en todos los niveles donde aparecen.

## 2. Dónde vive esta distinción

**En el build del portal `ccp`** (`VITE_SICSAFT_NIVEL`, horneado desde `NIVEL_PRODUCTO` en el
`.env` por `instalar-cliente.ps1 -Nivel N` — o desde `instalacion.json` en `sicsaft-core.exe`),
**no a nivel de dato**. No se agrega ningún campo "nivel" a `Contrato`/`Organización`/`Sede` en
`base-patrimonial/` — el nivel contratado no es un atributo del dominio patrimonial. Desde
2026-09-02 tampoco es una decisión de qué contenedores levantar: Nivel 1 y Nivel 2 despliegan los
mismos servicios (ver §1.1). La distinción vive solo en ese flag de build del CCP, que decide si
el módulo Dashboard/CIP aparece.

## 3. Qué queda explícitamente fuera de los 3 niveles

- **Observabilidad (Prometheus/Loki/Grafana), `k6`, dashboard de Traefik**: herramienta del admin
  del producto, nunca se instala en el PC del cliente, en ningún nivel.

> **`cip/` — INST-Q-01, reabierto y cerrado de nuevo (2026-09-02)**: **CIP es una capacidad de
> Nivel 2** (Modo Profesional), no de Nivel 1. Revierte el cierre del 2026-08-25 (que lo ponía en
> Nivel 1). Motivo: el Tomo IV lista "reportes / indicadores / inteligencia" como valor del Modo
> Profesional, no del Básico; un cliente Modo Básico no paga BI.
>
> - **Superficie visible** (lo que enforza el producto hoy): el módulo **Dashboard** del CCP —
>   único consumidor de CIP — es lo **único** gateado a Nivel 2 (`ccp/src/lib/nivel.ts`,
>   `MODULOS_CIP`). El resto del CCP va completo desde Nivel 1 (corrección 2026-09-02).
> - **`devops/onprem/docker-compose.yml`**: `cip`/`cip-migrate` **siguen arrancando desde el
>   boot** por ahora, porque `cis` valida `CIP_URL`/`CIP_SERVICE_TOKEN` de forma incondicional
>   (`cip-client.config.ts`). Gatearlos por nivel exigiría que CIS degrade con elegancia cuando
>   CIP no está — **follow-up**, no bloquea la venta por nivel (un cliente Nivel 1 corre el
>   contenedor `cip` pero el Dashboard queda oculto en el CCP, no ve ni paga la capacidad). El
>   `.exe` (`sicsaft-core`) tiene la misma situación: embebe CIP siempre, lo expone solo en Nivel 2.
> - Base propia `cip` separada de `core` (RNF-01/RNF-05) y el consumo real de eventos por pg-boss
>   (ADR-005) no cambian.

## 4. Relación con `ADR-004` (Keycloak, reemplaza a `ADR-002`/Zitadel)

> **Nota histórica**: esta sección originalmente describía la relación con `ADR-002` (Zitadel
> multi-tenant) — `ADR-004` (2026-08-26) reemplazó a Zitadel por Keycloak en todo el ecosistema
> (Fase 3 de esa migración es justamente `devops/onprem/`, ver `ARCHITECTURE.md`). El razonamiento
> de esta sección sigue aplicando igual, solo cambia el IdP concreto.

`ADR-004` diseñó Keycloak para multi-tenant **dentro de un mismo realm compartido**
(`devops/local/`/`devops/prod/`: varias Organizations de Keycloak en un único realm `sicsaft`,
reemplazo directo del modelo de varias Organizaciones de Zitadel en una instancia compartida que
usaba `ADR-002`). El modelo on-premise de este documento es distinto: **una instancia de Keycloak
completa por cliente**, con un único realm `sicsaft` y una sola Organization activa — no una
Organization más dentro de una instancia compartida. No contradice `ADR-004` — es un modelo de
despliegue paralelo (VPS compartido vs. instalación aislada), ambos coexisten como opciones de
venta distintas, no se reemplaza uno por otro.

## 5. Justificación de negocio por nivel

> Contenido de negocio aportado directamente por el usuario (2026-08-25), no un tomo oficial —
> registrado acá porque razona **por qué** la tabla de la sección 1 tiene sentido comercial, no
> solo qué contiene. No cambia ninguna definición técnica de las secciones 1-4.

**Nivel 1 — alta prioridad**: tiene una lógica comercial clara y autosuficiente — bajo costo
tecnológico, instalación sencilla, inventario digital, trazabilidad y una Base Patrimonial real
desde el primer día, con camino de crecimiento hacia Nivel 2/3 sin migrar de plataforma. Es el
nivel de entrada natural: no depende de que el cliente compre nada más para justificar su precio.

**Nivel 2 — alta prioridad, viable**: lo que suma es el **CIP** — reportes, indicadores, alertas
y análisis ejecutivo sobre la Base Patrimonial. Ese valor está condicionado a que ya exista CORE y
la Base Patrimonial con datos reales detrás (Nivel 1): un dashboard sobre una base vacía no es
ventaja competitiva. Por eso Nivel 2 nunca se vende suelto — es Nivel 1 obligatorio más el CIP
(consistente con la tabla de la sección 1: Nivel 2 = Nivel 1 + `cip`, no un stack alternativo). El
CCP completo — administración, supervisión, gestión avanzada — ya viene en Nivel 1.

**Nivel 3 — viable, mediante integración**: RFID entra como conector adicional sobre lo que ya
existe (Nivel 2), no como una reconstrucción — mismo criterio ya fijado en la sección 1 ("RFID,
conectada a CIS preservando la independencia tecnológica de CORE"). La viabilidad comercial de
Nivel 3 depende de que Nivel 1/2 ya estén sólidos: es una extensión del valor existente, no un
producto aparte.
