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
| **APP SICSAFT** | APP SICSAFT (APP QR) | Captura vía QR | `app-qr-sicsaft/` |
| **CIS** | Centro de Interoperabilidad SICSAFT | Integración y validación de comunicaciones | `cis/` |
| **SICSAFT CORE** | SICSAFT CORE | Orquestación de procesos y gobierno de cambios patrimoniales | `core/` |
| **BPI** | **Base Patrimonial Inteligente** | Conservación y relación de la información patrimonial oficial | `base-patrimonial/` (modelo) · `core/migrations/` (implementación) |
| **CIP** | Centro de Inteligencia Patrimonial | Explotación: análisis, indicadores, alertas, inteligencia | `cip/` |
| **CCP** | Centro de Control Patrimonial | Interfaz de operación, administración y control patrimonial | `ccp/` |
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
| "web-aft liviano" (portal AFT de Nivel 1 nunca construido) | **CCP acotado** | El CCP está incluido en **todos** los niveles; en Nivel 1 corre con los módulos de gestión avanzada ocultos (flag `VITE_SICSAFT_NIVEL`, DOC-029 RF-A). No es una app distinta. |

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
| **Nivel 1** | **Modo Básico** | APP SICSAFT (QR) + CCP acotado | `postgres`, `keycloak`, `cis`, `core`, `app-qr-sicsaft`, `core-frontend` (Directivo), `web-admin` (Adm. del Sistema), **CCP** |
| **Nivel 2** | **Modo Profesional** | Nivel 1 + WEB completa + **CIP** (indicadores) | Nivel 1 + **`ccp` completo** + **`cip`** |
| **Nivel 3** | **Modo Enterprise** | Nivel 2 + RFID | Nivel 2 + `rfid/` (no iniciado) |

- **El CCP está en todos los niveles.** En Nivel 1 los módulos de gestión avanzada (Estructura,
  alta manual de Activos) y el Dashboard/indicadores quedan ocultos; en Nivel 2 se muestran.
- **CIP entra en Nivel 2** (2026-09-02, revierte el cierre INST-Q-01 del 2026-08-25 que lo ponía
  en Nivel 1). El módulo Dashboard del CCP, que consume CIP, es por lo tanto Nivel 2.
- Detalle y justificación de negocio en
  [DOC-025](aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

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
