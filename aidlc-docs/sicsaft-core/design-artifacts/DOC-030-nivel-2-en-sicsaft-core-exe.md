# DOC-030 — Nivel 2 en `sicsaft-core.exe`

> Cierra la parte **Nivel 2** de `CORE-Q-03` (`requirements/INTENT.md`): el instalador de
> escritorio pasa de "Nivel 1 con el CCP acotado" a "**Nivel 2** — **CCP completo**", sin salir
> del patrón de procesos embebidos (sin Podman). No reabre ADR-004/ADR-005. Se apoya en
> [DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-A (el flag
> `nivel` en el CCP) y complementa [DOC-028](DOC-028-camino-a-cliente-final.md) y
> [DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

> **Origen (2026-09-02)**: el próximo cliente es **Nivel 2**. El `.exe` hoy hornea `nivel: 1`
> (`handlers.ts` `marcarInstalacionCompleta`, `PasoDatosCliente.tsx` `bootstrapCliente`).
> "Nivel 2 hoy se activa editando `instalacion.json` a mano" (comentario en `handlers.ts`) no es
> entregable.

> **Decisión del usuario (2026-09-02)**: el portal de Administración del Sistema (`web_admin/`)
> **no se embebe** y **no** se hace ningún portal de administración remota — *"quita la web admin
> por completo porque no quiero conectarme a nada del cliente"*. La instalación es autocontenida:
> ninguna vía para que el proveedor entre al `.exe` del cliente. Esto **descarta el Corte B** que
> este documento contemplaba en su borrador y **deja [DOC-028](DOC-028-camino-a-cliente-final.md)
> Fase F (portal de administración remota) sin efecto** — ver el punto 5.

**Estado: diseño listo — alcance cerrado (solo el flag de nivel). Implementable.**

---

## 1. Qué es "Nivel 2" acá y qué falta hoy

[DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md) 1:
**Nivel 2 = Nivel 1 + `ccp/` (CCP completo)**. La excepción de `sicsaft-core.exe` (2026-08-28) ya
embebe `ccp/` **entero**; [DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)
RF-A le puso un flag `VITE_SICSAFT_NIVEL` que en `1` **oculta** los módulos de gestión avanzada
(Estructura, alta manual de Activos). Nivel 2 = servir ese mismo CCP con el flag en `2`.

| Pieza | Nivel 1 (hoy) | Nivel 2 (objetivo) |
|---|---|---|
| Postgres / Keycloak / CIS / CORE / CIP | ✅ embebidos | ✅ sin cambios |
| Portal Directivo (`core/frontend`) | ✅ embebido | ✅ sin cambios |
| **CCP** (`ccp/`) | ✅ embebido, **acotado** por `VITE_SICSAFT_NIVEL=1` | **completo** — `VITE_SICSAFT_NIVEL=2` |
| APP QR (PWA) | ✅ servida por el `.exe` (DOC-028 D) | ✅ sin cambios |
| Portal Administración del Sistema (`web_admin/`) | ❌ no embebido | ❌ **sigue sin embeberse** — decisión del usuario, ver arriba |

### 1.1 Hallazgo que acota el alcance a "un flag"

`ccp/src/lib/nivel.ts` `moduloHabilitado(path)` = `nivelActual() === 2 || MODULOS_NIVEL_1.has(path)`.
**No consulta `modulosContratados`.** El gate de módulos avanzados del CCP embebido depende
**solo** de `VITE_SICSAFT_NIVEL`. Y `asegurarServidoresPortales` (`handlers.ts`) **ya** lee
`instalacion?.nivel ?? 1` e inyecta ese valor. Consecuencias:

- Para "CCP completo" en Nivel 2 alcanza con que el `nivel` **persistido** sea `2`.
- `core-provisioning.ts` (`MODULOS_CONTRATADOS = ["inventario-qr"]`, único valor del vocabulario
  de [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) 5) **no cambia**.
- No hay migración, ni endpoint nuevo, ni portal nuevo. Es threading de un campo por el wizard.

### 1.2 Qué NO cubre Nivel 2 en el `.exe` (y cómo se resuelve)

Sin `web_admin/`, la capacidad "administración web" de DOC-025 (organizaciones, sedes, contratos,
usuarios) se cubre así:

| Necesidad | Cómo se resuelve sin `web_admin` |
|---|---|
| Organización + contrato + sede principal | Los crea el **wizard** al instalar (`provisionarOrganizacionCore`, DOC-028 B.2). |
| Alta del Director | Paso 2 del wizard. |
| Alta del Profesional de AFT | Paso 3 del wizard **y** el portal Directivo (`core/frontend`, "designar Profesional de AFT", `cis/src/directivo/`) para sumar más después. |
| Áreas / ubicaciones / responsables | Módulo **Estructura** del CCP (se desbloquea justamente con Nivel 2). |
| Más sedes, cambios de contrato | **Fuera de alcance de la instalación autocontenida.** Si el cliente lo necesita, es una reinstalación/reconfiguración asistida, no un portal en su PC. Documentar la limitación en el runbook. |

---

## 2. Corte único — el flag de nivel

El `.exe` deja de hornear `nivel: 1`; el vendedor lo elige en el wizard.

| # | Archivo | Cambio |
|---|---|---|
| A.1 | `src/shared/ipc-contract.ts` | `DatosClienteInput` gana `nivel: 1 \| 2`. (`InstalacionCompleta.nivel` ya está tipado `1 \| 2`.) |
| A.2 | `src/renderer/src/wizard/PasoDatosCliente.tsx` | El `schema` zod y el formulario ganan **`nivel`** — radio "Nivel 1 / Nivel 2" con una línea de ayuda (qué desbloquea cada uno). **Default `1`** (comportamiento actual; el vendedor sube a `2` a conciencia según el contrato). Pasa `nivel` en `bootstrapCliente({ ...values })` en vez del `nivel: 1` fijo. |
| A.3 | `src/main/ipc/handlers.ts` | `bootstrapCliente`: `marcarInstalacionCompleta({ ..., nivel: input.nivel })`. Se borra el comentario "Nivel 2 hoy se activa editando `instalacion.json` a mano; un paso del wizard para elegirlo es trabajo futuro". |
| A.4 | tests (`src/**/*.test.ts(x)`) | `PasoDatosCliente`: render del radio + submit propaga `nivel` (vitest/RTL). `handlers` / `instalacion-marker`: `bootstrapCliente` persiste el `nivel` recibido, no un fijo. `nivelActual()`/`moduloHabilitado()` ya tienen contrato en `ccp/src/lib/nivel.test.ts` — no se tocan. |

Nada más. `asegurarServidoresPortales` ya consume `instalacion.nivel`. Una instalación anterior a
DOC-030 sin el campo → `?? 1` (Nivel 1), igual que hoy.

**Entrega**: un `.exe` instalado eligiendo "Nivel 2" en el wizard sirve el **CCP completo**
(Estructura, alta manual de Activos, todo lo que `MODULOS_NIVEL_1` ocultaba). Sin portal de
Administración del Sistema, sin conexión remota de ningún tipo.

---

## 3. Plan de ramas / `gh stack`

Sobre la punta del stack de DOC-029 (`feat/ccp-auditoria-area`), porque el flag `nivel` lo
introdujo RF-A.

| # | Rama | Contenido | Depende de |
|---|------|-----------|------------|
| 1 | `docs/doc-030-nivel-2-en-sicsaft-core-exe` | este diseño | `feat/ccp-auditoria-area` |
| 2 | `feat/sicsaft-core-nivel-selector` | A.1–A.4 + doc-sync (punto 4) | 1 |

Se enchufa al final del `gh stack` de DOC-029.

## 4. Documentación a sincronizar

En la misma rama `feat/sicsaft-core-nivel-selector` (código + su doc-sync, `docs:` inmediatamente
siguiente si hace falta):

- `aidlc-docs/sicsaft-core/requirements/INTENT.md` — `CORE-Q-03`: la parte **Nivel 2** queda
  resuelta ("sí, mismo patrón embebido — solo el CCP, sin `web_admin`; ver DOC-030"). **Nivel 3
  (RFID)** sigue abierta.
- `aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md` — RF nuevo: selector de nivel en el wizard.
- `aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md` — "próximo paso" #4 (CORE-Q-03) deja de decir
  "sin resolver" para la parte Nivel 2.
- `aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md` — punto 4: el `.exe` ya
  cubre Nivel 2. **Fase F (portal admin remoto): marcarla `❌ descartada`** con el motivo (decisión
  del usuario 2026-09-02, sin conexión al cliente).
- `aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md` — la **excepción de
  `sicsaft-core.exe`** (2026-08-28) se amplía: el `.exe` soporta Nivel 1 **y** Nivel 2 vía el flag
  del wizard; `web_admin/` (Administración del Sistema) **no** entra al `.exe` en ningún nivel — en
  ese camino de instalación la administración web es una operación asistida del proveedor al
  instalar, no un portal en la PC del cliente. El modelo de perfiles Compose de `devops/onprem/`
  no cambia.
- `sicsaft-core/README.md` — bloque de estado: selector de nivel; aclarar que `web_admin` no se
  embebe.
- `README.md` raíz — SYS-11: "Nivel 1 completo" → "Nivel 1 y 2 (sin portal Admin del Sistema)".
- `ROADMAP.md` — track `sicsaft-core`: CORE-Q-03 (Nivel 2) hecho; Fase F de DOC-028 descartada.
- `aidlc-docs/ccp/design-artifacts/DOC-029-...` Bitácora — nota del incremento Nivel 2.
- Diagramas: `aidlc-docs/diagrams/nivel2-arquitectura.html` / `nivel2-despliegue.html` (hoy asumen
  Compose/Podman — agregar la variante `.exe`, sin `web_admin`), `sicsaft-core-arquitectura.html`
  (sigue con 2 portales servidos: `ccp` + `core-frontend`), `launcher-arquitectura.html`.

## 5. Efecto sobre DOC-028 Fase F (PR #70)

Fase F era *"un portal de administración remota para dar soporte a un `.exe` instalado en el campo
sin subirse a la PC del cliente"* — es decir, exactamente una vía de conexión del proveedor al
cliente. La decisión del usuario del 2026-09-02 la contradice de raíz. **Recomendación: cerrar el
PR #70 sin mergear** y marcar Fase F como descartada en DOC-028. Cualquier soporte post-instalación
se hace de forma presencial o con un export/paquete que el cliente envía, no con un canal abierto.

*(No lo cierro yo — es tu PR y tu decisión; queda anotado acá y en la doc-sync del punto 4.)*

## 6. Estrategia de testing

Sin bajar el umbral vigente de `sicsaft-core` (vitest).

- **Unit**: `PasoDatosCliente` con el radio de nivel (render + submit propaga `nivel`);
  `bootstrapCliente` persiste el `nivel` recibido (no un fijo); regresión de que una instalación
  sin el campo `nivel` sigue resolviendo a `1`.
- **Contrato del consumidor**: `ccp/src/lib/nivel.test.ts` ya cubre `nivelActual()`/`moduloHabilitado()`
  para `1` y `2` — no se toca, sirve de red.
- **Manual / e2e** (runbook de DOC-028 4, con Nivel 2): `npm run pack` → instalar el
  `win-unpacked` → elegir "Nivel 2" en el wizard → verificar que el CCP muestra **Estructura** y el
  **alta manual de Activos** (ocultos en Nivel 1).

## 7. Fuera de alcance de DOC-030

- **`web_admin/` embebido** y **cualquier portal/canal de administración remota** — descartados por
  decisión del usuario.
- **Nivel 3 (RFID)** en el `.exe` — `CORE-Q-03` parte RFID sigue abierta (sin código `rfid/`).
- **RF-B.6.2** de DOC-029 (watcher de ingesta de Excel + service account + empaquetado del sidecar
  Python) — un cliente Nivel 2 real probablemente lo necesita, pero es su propio frente; DOC-030
  no lo incluye ni lo bloquea.
- Empaquetar `web_admin` (ya no aplica). Optimizar el tamaño del instalador por nivel — trabajo
  futuro, no de esta fase.

## Documentos relacionados

[DOC-028](DOC-028-camino-a-cliente-final.md) (camino a cliente final; Fase F descartada, ver el punto 5),
[DOC-025](../../devops/design-artifacts/DOC-025-niveles-producto-onprem.md) 1/2 (modelo de
niveles + la excepción de `sicsaft-core.exe`),
[DOC-029](../../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-A (flag `nivel`
en el CCP), [DOC-022](../../ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
(los 3 portales por rol), [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) 5
(`modulosContratados`), `requirements/INTENT.md` `CORE-Q-03`.
