# DOC-030 — Nivel 2 en `sicsaft-core.exe`

> Cierra la parte **Nivel 2** de `CORE-Q-03` (`requirements/INTENT.md`): el instalador de
> escritorio pasa de "Nivel 1 con el CCP acotado" a "**Nivel 2** — CCP completo + portal de
> Administración del Sistema", sin salir del patrón de procesos embebidos (sin Podman). No reabre
> ADR-004/ADR-005. Complementa [DOC-028](DOC-028-camino-a-cliente-final.md) (del que **adelanta
> F.1/F.2/F.5**) y [DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md)
> (modelo de niveles) y se apoya en [DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)
> RF-A (el flag `nivel` en el CCP).

> **Origen (2026-09-02)**: el próximo cliente es **Nivel 2**. El `.exe` hoy hornea `nivel: 1`
> (`handlers.ts` `marcarInstalacionCompleta`, `PasoDatosCliente.tsx` `bootstrapCliente`) y no
> embebe `web_admin/`. "Nivel 2 hoy se activa editando `instalacion.json` a mano" (comentario en
> `handlers.ts`) no es entregable.

**Estado: diseño — pendiente de OK del usuario en la §Decisión abierta antes de tocar `src/`.**

---

## 1. Qué es "Nivel 2" y qué falta hoy

[DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md) §1:
**Nivel 2 = Nivel 1 + `ccp/` (CCP completo)** + capacidades: *administración web, gestión
avanzada, supervisión, consultas institucionales, reportes, configuración, operación
centralizada*.

Traducido a servicios del `.exe`:

| Pieza | Nivel 1 (hoy) | Nivel 2 (objetivo) |
|---|---|---|
| Postgres / Keycloak / CIS / CORE / CIP | ✅ embebidos | ✅ sin cambios |
| Portal Directivo (`core/frontend`) | ✅ embebido | ✅ sin cambios |
| **CCP** (`ccp/`) | ✅ embebido pero **acotado** — `VITE_SICSAFT_NIVEL=1` oculta Estructura, alta manual de Activos, gestión avanzada (`ccp/src/lib/nivel.ts` `moduloHabilitado`) | **CCP completo** — `VITE_SICSAFT_NIVEL=2` |
| **Portal Administración del Sistema** (`web_admin/`) | ❌ **no embebido**, sin ruteo del rol `administrador-sistema` | **decisión abierta** — ver §Decisión |
| APP QR (PWA) | ✅ servida por el `.exe` (DOC-028 D) | ✅ sin cambios |

### 1.1 Hallazgo que acota el alcance

`ccp/src/lib/nivel.ts` `moduloHabilitado(path)` = `nivelActual() === 2 || MODULOS_NIVEL_1.has(path)`.
**No consulta `modulosContratados`.** El gate de módulos avanzados del CCP embebido depende
**solo** de `VITE_SICSAFT_NIVEL`. Consecuencia: para "CCP completo" en Nivel 2 alcanza con inyectar
`2` — `core-provisioning.ts` (`MODULOS_CONTRATADOS = ["inventario-qr"]`, único valor del
vocabulario de [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) §5) **no cambia**
(sigue habilitando el Conector QR, que Nivel 1 y 2 comparten).

`asegurarServidoresPortales` (`handlers.ts`) **ya** lee `instalacion?.nivel ?? 1` e inyecta
`VITE_SICSAFT_NIVEL`. Lo único que falta del lado del CCP es que el `nivel` persistido sea `2`.

---

## 2. Los dos cortes

### Corte A — el flag de nivel (chico, autocontenido)

El `.exe` deja de hornear `nivel: 1`; el vendedor lo elige en el wizard.

| # | Archivo | Cambio |
|---|---|---|
| A.1 | `src/renderer/src/wizard/PasoDatosCliente.tsx` | El schema/formulario gana **`nivel: 1 \| 2`** (radio o select, default `2` para el cliente actual — el vendedor lo confirma). Pasa `nivel` en `bootstrapCliente(...)` en vez del `nivel: 1` fijo. |
| A.2 | `src/shared/ipc-contract.ts` | `DatosClienteInput` gana `nivel: 1 \| 2` (`InstalacionCompleta.nivel` ya está tipado). |
| A.3 | `src/main/ipc/handlers.ts` | `bootstrapCliente`: `marcarInstalacionCompleta({ ..., nivel: input.nivel })` en vez de `nivel: 1`. Se borra el comentario "Nivel 2 hoy se activa editando `instalacion.json` a mano". |
| A.4 | tests | `PasoDatosCliente` render + submit con `nivel` (vitest/RTL); handler `bootstrapCliente` persiste el `nivel` recibido (unit del `handlers.ts` o `instalacion-marker`). |

**Entrega del Corte A**: un `.exe` instalado con Nivel 2 elegido en el wizard sirve el **CCP
completo** (Estructura, alta manual de Activos, todo lo que `MODULOS_NIVEL_1` ocultaba). **No**
agrega el portal de Administración del Sistema — eso es el Corte B.

### Corte B — portal de Administración del Sistema (`web_admin/`)

Es lo que da la capacidad "**administración web**" de Nivel 2 (organizaciones, **sedes**,
contratos, usuarios). Coincide con **DOC-028 Fase F.1/F.2/F.5** — este corte los **adelanta** (la
parte cliente-facing); el resto de Fase F (API de mantenimiento remoto F.3, export `.docx` de
auditoría F.4, decisión de actualización de binario) sigue siendo su propio incremento.

| # | Archivo | Cambio |
|---|---|---|
| B.1 | `package.json` `build.extraResources` + `scripts/prepack.cjs` | `web_admin/dist` → `extraResources` (`from: "../web_admin"`, `to: "web-admin"`, `filter: ["dist/**/*"]`, mismo patrón que `ccp`). `prepack.cjs` agrega `npm run build` de `web_admin/`. Es un build estático de Vite (`web_admin/package.json` → `tsc -b && vite build`), sin el workaround `node_modules` de `cis/core` en `electron-builder-after-pack.cjs`. |
| B.2 | `src/main/services/static-portal-server.ts` | `rutaDistDePortal` acepta `"web-admin"`; nuevo `PUERTO_WEB_ADMIN` (p. ej. `PUERTO_CCP + 1`). |
| B.3 | `src/main/ipc/handlers.ts` `asegurarServidoresPortales` | Un `iniciarServidorEstatico({ nombre: "web-admin", ... })` más, **solo si `nivel === 2`**. `configRuntime`: `VITE_KEYCLOAK_ISSUER` (mismo issuer runtime de Fase C.0), `VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_WEB_ADMIN`, `VITE_CIS_URL`. |
| B.4 | `src/main/services/keycloak-bootstrap.ts` | Provisiona el client OIDC público `web-admin` (redirect a `http://127.0.0.1:<PUERTO_WEB_ADMIN>/*`), mismo patrón que los clients `ccp`/`core-frontend`/`app-qr-sicsaft` que ya crea. |
| B.5 | `src/main/services/portal-login-service.ts` | `resolverOrigenPortal`: `roles.includes("administrador-sistema")` → `http://127.0.0.1:${PUERTO_WEB_ADMIN}`. Constante `ROL_ADMIN_SISTEMA = "administrador-sistema"` (el mismo string que `cis/src/.../directivo.constants.ts` y que `web_admin/` exige en sus páginas). |
| B.6 | `src/renderer/src/wizard/PasoAdminSistema.tsx` **(nuevo)** + `WizardApp.tsx` | 4.º paso del wizard, **opcional** (mismo patrón que `PasoProfesionalAft.tsx`): alta del Administrador del Sistema. Handler IPC `altaAdminSistema` → `crearUsuarioAdminSistema(admin, orgId, email)` (wrapper de `crearUsuarioHumano`, rol `administrador-sistema`). Solo se muestra si `nivel === 2`. |
| B.7 | `src/renderer/src/wizard/PasoListoConLogin.tsx` | Si `nivel === 2`: botón/enlace "Administración del sistema" que abre el portal `web-admin` en el navegador embebido (o el default) — DOC-028 F.2, variante local. |
| B.8 | tests | `resolverOrigenPortal` con rol `administrador-sistema`; `asegurarServidoresPortales` arranca `web-admin` solo en `nivel === 2`; `PasoAdminSistema` render/submit; `keycloak-bootstrap` crea el client `web-admin`. |

**Entrega del Corte B**: un `.exe` Nivel 2 sirve además `web_admin/` en `:PUERTO_WEB_ADMIN`; el
login detecta el rol `administrador-sistema` y lo lleva ahí; el wizard ofrece crear esa cuenta.

---

## 3. §Decisión abierta — ¿Corte B entra en esta entrega?

El cliente es Nivel 2. La capacidad "administración web" (orgs/sedes/contratos/usuarios) tiene
tres caminos y **necesito tu OK** antes de codear el Corte B:

| Opción | Qué implica | Cuándo alcanza |
|---|---|---|
| **B-completo** | Se implementa el Corte B entero (portal embebido + paso de wizard + ruteo de rol). El cliente administra su instalación desde `web_admin/` en la propia PC. | El cliente quiere gestionar sedes/contratos/usuarios por su cuenta. |
| **B-diferido (solo Corte A)** | Solo el flag de nivel. La administración la hacés **vos**: el alta de más usuarios AFT ya la cubre el **portal Directivo** (`core/frontend`, "designar Profesional de AFT", `cis/src/directivo/`); orgs/contratos/sedes se tocan una vez en el wizard, y cambios puntuales por AnyDesk/SQL o esperando **DOC-028 Fase F** (portal de admin **remoto**, PR #70). | El cliente no necesita autoservicio de administración; vos operás el mantenimiento. |
| **B-vía-Fase-F** | No se adelanta nada acá; el Corte B se hace dentro de DOC-028 Fase F cuando se resuelvan sus 3 decisiones abiertas (exposición LAN, update de binario, export `.docx`). Esta entrega = solo Corte A. | Igual que B-completo pero se prefiere una sola implementación de `web_admin` embebido, junto con la API de mantenimiento remoto. |

**Recomendación**: **B-diferido (solo Corte A)** para esta entrega — desbloquea el CCP completo
(que es el 80% de lo que "Nivel 2" significa para el usuario del día a día) sin abrir las
decisiones de Fase F, y el autoservicio de administración se suma después vía Fase F si el cliente
lo pide. Confirmá cuál.

---

## 4. Plan de ramas / `gh stack`

Sobre la punta del stack de DOC-029 (`feat/ccp-auditoria-area`), porque el Corte A depende del
flag `nivel` de RF-A.

| # | Rama | Corte | Depende de |
|---|------|-------|------------|
| 1 | `docs/doc-030-nivel-2-en-sicsaft-core-exe` | este diseño | `feat/ccp-auditoria-area` |
| 2 | `feat/sicsaft-core-nivel-selector` | **Corte A** (A.1–A.4) | 1 |
| 3 | `feat/sicsaft-core-web-admin-embebido` | **Corte B** (B.1–B.8) — **solo si B-completo** | 2 |

Se enchufa al final del `gh stack` de DOC-029 (después de `feat/ccp-veredicto-accionable` de RF-D
si RF-D entra antes; si no, directo después de `#17`).

## 5. Documentación a sincronizar ("actualiza todo")

Al mergear (no antes — el estado real sigue siendo "en rama"):

- `aidlc-docs/sicsaft-core/requirements/INTENT.md` — `CORE-Q-03`: la parte **Nivel 2** queda
  resuelta ("sí, mismo patrón embebido, ver DOC-030"); **Nivel 3 (RFID)** sigue abierta.
- `aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md` — RF nuevo(s) del selector de nivel / portal admin.
- `aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md` — estado + "próximo paso": #4 (CORE-Q-03) deja de decir "sin resolver".
- `aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md` — §4 "definición de listo": el `.exe` ya cubre Nivel 2; F.1/F.2/F.5 marcadas "adelantadas por DOC-030".
- `aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md` — la **excepción de `sicsaft-core.exe`** (2026-08-28) se amplía: el `.exe` ya no es solo Nivel 1, soporta Nivel 2 vía el flag del wizard (+ `web_admin` embebido si B-completo). El modelo de perfiles Compose de `devops/onprem/` sigue igual.
- `sicsaft-core/README.md` — bloque de estado: selector de nivel, (portal admin embebido).
- `README.md` raíz — SYS-11: "Nivel 1 completo" → "Nivel 1 y 2".
- `CLAUDE.md` — si menciona "`.exe` = Nivel 1" en algún lado, ajustar.
- `ROADMAP.md` — track `sicsaft-core`: CORE-Q-03 (Nivel 2) hecho.
- `aidlc-docs/ccp/design-artifacts/DOC-029-...` §Bitácora — nota del incremento Nivel 2.
- Diagramas: `aidlc-docs/diagrams/sicsaft-core-arquitectura.html` (agregar `web-admin` como portal servido si B-completo), `nivel2-arquitectura.html` / `nivel2-despliegue.html` (hoy asumen Compose/Podman — agregar la variante `.exe`), `launcher-arquitectura.html`, `organigrama-roles.html` (el rol `administrador-sistema` ya entra al `.exe`).

## 6. Estrategia de testing

Sin bajar el umbral vigente (`sicsaft-core` vitest, `web_admin` vitest, e2e de `ccp`).

- **Corte A**: unit del selector de nivel (`PasoDatosCliente`), unit de que `bootstrapCliente`
  persiste el `nivel` recibido, y un test de `moduloHabilitado`/`nivelActual` ya cubierto en
  `ccp/src/lib/nivel.test.ts` (no se toca — sirve de contrato del consumidor).
- **Corte B**: unit de `resolverOrigenPortal` (rol `administrador-sistema` → puerto correcto; sin
  rol conocido → error, ya cubierto), unit de que `asegurarServidoresPortales` **no** arranca
  `web-admin` en `nivel === 1` y **sí** en `nivel === 2`, unit de `keycloak-bootstrap` (client
  `web-admin` creado con el redirect correcto), render de `PasoAdminSistema`.
- **Manual / e2e**: `npm run pack` → instalar el `win-unpacked`, elegir Nivel 2 en el wizard,
  verificar (a) CCP muestra Estructura + alta de Activos, (b) [B] login como `administrador-sistema`
  abre `web_admin`. Es el mismo runbook de verificación E2E de DOC-028 §4, con Nivel 2.

## 7. Fuera de alcance de DOC-030

- **Nivel 3 (RFID)** en el `.exe` — `CORE-Q-03` parte RFID sigue abierta (sin código `rfid/`).
- **DOC-028 Fase F** completa (API de mantenimiento remoto F.3, export `.docx` F.4, update de
  binario) — se implementa aparte; DOC-030 solo adelanta F.1/F.2/F.5.
- **RF-B.6.2** de DOC-029 (watcher de ingesta de Excel + service account + empaquetado del sidecar
  Python) — un cliente Nivel 2 real probablemente lo necesita, pero es su propio frente; DOC-030
  no lo incluye ni lo bloquea.
- Empaquetar `web_admin` **solo si el `.exe` es Nivel 2** en tiempo de build (hoy se copiaría
  siempre; el gate es en runtime por `nivel`). Optimizar el tamaño del instalador por nivel es
  trabajo futuro, no de esta fase.

## §Documentos relacionados

[DOC-028](DOC-028-camino-a-cliente-final.md) (camino a cliente final — Fases A-D hechas, F
adelantada en parte acá), [DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md)
§1/§2 (modelo de niveles + la excepción de `sicsaft-core.exe`),
[DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-A (flag `nivel`
en el CCP), [DOC-022](../../ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
(los 3 portales por rol), [DOC-023](../../ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md)
(rol `administrador-sistema`), [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) §5
(`modulosContratados`), `requirements/INTENT.md` `CORE-Q-03`.
