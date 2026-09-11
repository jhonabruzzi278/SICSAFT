# SICSAFT — Catálogo maestro de nomenclatura

Fuente: Tomo III (principios) + Tomo IV (arquitectura funcional y modelo de datos). Este archivo
es la denominación **vigente y obligatoria** — cualquier documento, comentario de código o UI que
diga otra cosa está desactualizado y se corrige, no se cita como precedente.

Enlazado desde [CLAUDE.md](CLAUDE.md), [README.md](README.md) y
[ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).

---

## 1. Componentes del ecosistema

| Sigla | Nombre vigente | Responsabilidad única (Tomo IV) | Carpeta |
|---|---|---|---|
| **APP SICSAFT** | APP SICSAFT (APP QR) | Captura vía QR en terreno (PWA instalable) | `app-qr-sicsaft/` |
| **CIS** | Centro de Interoperabilidad SICSAFT | Integración, validación de comunicaciones y proxy auth Keycloak | `cis/` |
| **SICSAFT CORE** | SICSAFT CORE (Backend) | Orquestación de procesos y gobierno de cambios patrimoniales | `core/` |
| **DIRECTIVO** | Portal WEB del Directivo | Visualización ejecutiva, estructura y designación del Profesional AFT | `core/frontend/` |
| **BPI** | **Base Patrimonial Inteligente** | Conservación y relación de la información patrimonial oficial | `base-patrimonial/` (modelo) · `core/migrations/` (implementación) |
| **CIP** | Centro de Inteligencia Patrimonial | Explotación: análisis, indicadores, alertas, inteligencia (Nivel 2) | `cip/` |
| **CCP** | Centro de Control Patrimonial | Interfaz de operación, administración y control patrimonial (AFT) | `ccp/` |
| **SICSAFT HOST** | SICSAFT CORE (.exe) | App nativa Electron / NSIS que orquesta el stack On-Premise | `sicsaft-core/` |
| **ETL CONTABLE** | Ingesta Contable Excel | Sidecar Python (pandas/xlrd) para normalización de planillas | `herramientas/etl-contable/` |
| **APK AFT** | APP Android WebView | WebView Android nativa para distribución local desde el .exe | `apk-aft/` (esqueleto Gradle; opcional — la PWA es el camino base) |
| **RFID** | RFID SICSAFT | Captura automática de eventos | `rfid/` (no iniciado) |

### 1.1 `CCP ≠ CIP` — distinción congelada

- **CCP** — Centro de **Control** Patrimonial: interfaz de operación/administración/control. El
  Profesional de AFT que modifica un responsable autorizado trabaja en el CCP.
- **CIP** — Centro de **Inteligencia** Patrimonial: capa de explotación, indicadores, alertas. El
  Directivo que mira "activos no localizados" mira un tablero servido por CIP.

Nunca se usan como sinónimos. Que el CCP muestre tableros alimentados por CIP (módulo Dashboard)
no funde los conceptos: el CCP es el continente operativo, CIP la capa analítica que consume.

## 2. Denominaciones depreciadas

| Ya NO se usa | Se usa | Notas |
|---|---|---|
| **Base Patrimonial Central** | **BPI — Base Patrimonial Inteligente** | Depreciada formalmente (2026-09-02, Tomo IV). Los `aidlc-docs/**/DOC-XXX.md` y diagramas anteriores a esta fecha son *snapshots*: conservan su texto; el trabajo nuevo usa BPI. |
| "la WEB" / "el Dashboard" como nombre del portal AFT | **CCP** | La WEB del Profesional de AFT **es** el CCP; "Dashboard" es solo uno de sus módulos. |
| "web-aft liviano" (portal AFT de Nivel 1 nunca construido) · "CCP acotado en Nivel 1" | **CCP** (a secas — es el mismo en todos los niveles) | El CCP está **completo** en todos los niveles (2026-09-02). Lo único que Nivel 2 agrega es el **Dashboard/indicadores**, que es **CIP**. No es una app distinta. Flag `VITE_SICSAFT_NIVEL` (DOC-029 RF-A). |

## 3. Los tres conceptos patrimoniales — no confundir

```
PATRIMONIO DIGITAL INSTITUCIONAL   ← concepto de negocio / patrimonial
            │
            ▼
           BPI                      ← estructura tecnológica de persistencia y organización
            │
            ▼
  DISEÑO / MODELO DE DATOS          ← especificación técnica (base-patrimonial/DOC-005)
            │
            ▼
 IMPLEMENTACIÓN EN SOFTWARE          ← core/migrations/ (Postgres real)
```

Son cuatro niveles distintos. Detalle en
[ARQUITECTURA-WAF.md, "Patrimonio Digital Institucional vs. BPI"](ARQUITECTURA-WAF.md#01-patrimonio-digital-institucional-vs-bpi--no-confundir-concepto-con-tecnología).

## 4. Niveles de producto (modos)

| Nivel | Modo | Alcance | Servicios |
|---|---|---|---|
| **Nivel 1** | **Modo Básico** | APP SICSAFT (QR) + **CCP completo** | `postgres`, `keycloak`, `cis`, `core`, `app-qr-sicsaft`, `core-frontend` (Directivo), **CCP** |
| **Nivel 2** | **Modo Profesional** | Nivel 1 + **CIP** (Dashboard de indicadores y análisis) | Nivel 1 + **`cip`** |
| **Nivel 3** | **Modo Enterprise** | Nivel 2 + RFID | Nivel 2 + `rfid/` (no iniciado) |

- **El CCP está completo en todos los niveles** (operación, administración, control: activos con
  alta manual, Estructura, importaciones, QR/Etiquetas, Auditoría). Corrección 2026-09-02 — antes
  Nivel 1 lo corría acotado; ese "CCP acotado" queda revertido.
- **La diferencia Nivel 1 ↔ 2 es el CIP**, no el CCP. **CIP entra en Nivel 2** (2026-09-02,
  revierte el cierre INST-Q-01 del 2026-08-25 que lo ponía en Nivel 1). El módulo **Dashboard** del
  CCP, que consume CIP, es lo único gateado a Nivel 2 (`ccp/src/lib/nivel.ts` `MODULOS_CIP`).
- **CCP ≠ CIP** (Tomo IV, "distinción absolutamente congelada"): CCP = *hacer* (modificar un
  responsable); CIP = *entender* (observar un indicador de activos no localizados).
- Detalle y justificación de negocio en
  [DOC-025](aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

### 4.1 Taxonomía de entrega: `Stage` vs. `Nivel` vs. `Fase`

- **Nivel / Modo**: Es la **superficie funcional comercial/licenciada** entregada al cliente (Nivel 1 = Modo Básico sin CIP; Nivel 2 = Modo Profesional con CIP; Nivel 3 = Modo Enterprise con RFID).
- **Stage**: Es el **hito de empaquetado, integración y congelamiento de proyecto** para entrega a producción. Tiene fronteras de alcance inmutables y criterios de cierre estrictos (Gate 1 para Stage 1 / Nivel 1; Gate 2 para Stage 2 / Nivel 2). Documento maestro de referencia: [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md).
- **Fase AI-DLC**: Es el **ciclo interno de ingeniería** que vive en `aidlc-docs/<sistema>/` (Inception → Construction → Operations).

## 5. Regla transversal — Profesional de AFT

El Profesional de AFT **no** es una integración automática con sistemas contables. Opera SICSAFT
por las interfaces autorizadas y mantiene/controla la información AFT.

```
PROFESIONAL AFT → CCP → CIS → CORE → BPI            ✅
PROFESIONAL AFT → BPI (directo)                     ❌
PROFESIONAL AFT ← integración automática contable   ❌
```

La ingesta de Excel contable (DOC-029 RF-B) respeta esto: el ETL es **transporte** (deja las filas
en una bandeja de *staging* de CORE, que **no** es la BPI); la escritura patrimonial solo ocurre
cuando el AFT **aprueba** el lote desde el CCP con su identidad real (CCP → CIS → CORE → BPI).

## 6. Principio no negociable (Tomo III)

**Ninguna fuente de captura (APP SICSAFT/QR, CCP/WEB, RFID u otra futura) modifica directamente la
información patrimonial oficial (BPI).** Todo cambio pasa primero por **CIS** y después por
**CORE**. Grabado en el diagrama de [README.md](README.md) y en las "Reglas no negociables" de
[CLAUDE.md](CLAUDE.md). Ningún cambio de código debe crear un atajo que lo rompa.
