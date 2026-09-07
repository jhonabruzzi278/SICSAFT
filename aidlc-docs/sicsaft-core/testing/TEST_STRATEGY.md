# Estrategia de pruebas — `sicsaft-core` (el `.exe` del cliente)

> Complementa [DOC-031](../design-artifacts/DOC-031-ambiente-real-y-endurecimiento.md). Define qué
> se prueba en cada capa y, sobre todo, **dónde vive la verdad** de que el entregable funciona.

## 1. Principio

El `.exe` es lo único que el cliente recibe. Un test que no corre contra el ejecutable empaquetado
no dice nada sobre el entregable — dice algo sobre el código fuente, que es distinto. Por eso:

> **En `sicsaft-core/e2e/` no entra ningún mock.** Si algo necesita mockearse para probarse, no
> pertenece a este harness.

Los bugs que llegaron a la primera entrega lo confirman: el `kc.bat` con espacio en la ruta
(PR #108), el single-instance, el watchdog del login y el `java` de Keycloak huérfano al cerrar
**sólo se reproducen en el `.exe` empaquetado e instalado**. Ninguno era visible desde los unit
tests ni desde `npm run dev`.

## 2. Las capas

| Capa | Herramienta | Contra qué corre | Qué prueba | Cuándo |
|---|---|---|---|---|
| Unitaria | Vitest (`npm test`) | Node puro, sin Electron | Lógica del proceso principal: `ManagedProcess`, bootstrap de Keycloak, `ingesta-watcher`, `lan-ip`, `instalacion-marker`, `logger` | Cada cambio |
| ETL contable | pytest + ruff | Python puro | `herramientas/etl-contable/`: mapeo de columnas, fill-down, formato CL, categoría por defecto, el `.xls` real de un cliente | Cada cambio (CI propio) |
| UI de la PWA | Playwright + **MSW** (`app-qr-sicsaft/tests/`) | Vite preview con la red mockeada | Comportamiento del front de la APP QR, aislado y rápido | Cada cambio del front |
| Casos de uso | Playwright + docker compose (`casos-de-uso/e2e/`) | Stack real por contenedores | Casos de negocio de punta a punta entre sistemas | Por PR de los sistemas |
| **Entregable** | Playwright + `_electron.launch` (`sicsaft-core/e2e/`) | **El `.exe` empaquetado real** | **Todo lo que recibe el cliente** | Por PR (subconjunto) + nightly (completa) |

`app-qr-sicsaft/tests/` es deliberadamente mockeada (`VITE_MOCK_API=true`): sirve para iterar el
front sin levantar nada. **No es evidencia de integración.** Esa evidencia vive en la capa de
entregable.

## 3. El harness del entregable

```
sicsaft-core/e2e/
  fixtures/    electron.ts (el `.exe` vivo, worker-scoped) · portales.ts (sesiones por rol)
               capturas.ts (screenshots) · artefactos.ts (credenciales entre specs)
  scripts/     exe-path · exe-process (servicios listos, limpieza de árbol) · db (lee la BPI) · appdata
  specs/       01..29
```

### Projects

| Project | Specs | Instancia del `.exe` |
|---|---|---|
| `principal` | 01–11, 14–18 | Una sola, compartida (worker fixture). El wizard corre en la 02 y el resto depende de ese estado |
| `ciclo-vida` | 12, 13, 19 | Cada spec lanza la suya. `dependencies: ['principal']` |
| `captura` *(DOC-031 Fase 1)* | 20–25 | La APP QR servida por el `.exe` en `https://<ip-lan>:8765`. `dependencies: ['principal']` |

### Qué cubre hoy (56 pruebas, verde)

Arranque de los 5 servicios embebidos y el bug del `kc.bat` con espacio · wizard de 3 pasos con su
efecto en Keycloak y en la BPI · single-instance · watchdog del login embebido · login OIDC por rol
· CCP completo (alta, estructura, edición, baja lógica sin `DELETE`, documentos, responsables,
etiquetas, auditoría, dashboard) · portal del Directivo (dashboard, designar AFT) · RBAC 403
server-side · auditoría en API y en la BPI · ingesta de Excel contable de punta a punta (incluido
el archivo real de un cliente de 252 activos) · relanzamiento · cierre limpio y sin huérfanos.

### Qué falta (DOC-031)

Sesión de inventario real desde la PWA · el CIP con datos · offline/sync · respaldo y restauración
· volumen · apagado abrupto.

## 4. Convenciones

- **Nada de mocks.** Ver §1.
- **La BPI se verifica leyendo Postgres**, no confiando en la respuesta HTTP: si la UI dice "creado"
  pero la fila no está, el test falla (`scripts/db.ts`).
- **Capturas** de cada pantalla nueva vía `fixtures/capturas.ts` → `.artefactos/capturas/` y
  adjuntas al reporte HTML.
- **`%APPDATA%\sicsaft-core` se aísla** en `global-setup` y se restaura en `global-teardown`: la
  corrida nunca pisa la instalación del desarrollador.
- **Las specs de regresión de un bug no usan la red de seguridad del harness.** La 19 (cierre sin
  huérfanos) no llama a `taskkill` antes de aseverar, justamente porque el bug era que el `.exe`
  dejaba procesos vivos. Un test que limpia por su cuenta lo que el producto debería limpiar no
  prueba nada.
- **Un bug real encontrado a mano ⇒ una spec.** Ver [DOC-027](../design-artifacts/DOC-027-bitacora-bugs-reales.md).

## 5. Correr las pruebas

```bash
cd sicsaft-core

npm test                 # unitarias (Vitest) — rápido
npm run e2e              # el harness completo contra el .exe instalado (~15 min)
npm run e2e:headed       # con ventana visible
npm run e2e:report       # abre el último reporte HTML
```

Contra un build recién hecho en vez de la instalación:

```bash
npm run pack
SICSAFT_CORE_EXE="$PWD/release/win-unpacked/SICSAFT CORE.exe" npm run e2e
```

Con el Excel real de un cliente por el pipeline de ingesta:

```bash
SICSAFT_INGESTA_XLSX="C:\ruta\a\activos.xlsx" npm run e2e
```

Un subconjunto:

```bash
npx playwright test --config e2e/playwright.config.ts --grep "02 - |19 - "
```

### Requisitos del entorno

- Windows. El `.exe` es el entregable y varios bugs son específicos de Windows.
- **~2 GB de RAM libre sin paginar.** Con menos, el proceso de red de Chromium crashea y tira la
  sesión CDP a mitad de un `page.evaluate`.
- El `.exe` instalado en `%LOCALAPPDATA%\Programs\SICSAFT CORE\` (ruta **con espacio**, que es la
  que reproduce el bug del `kc.bat`), o `SICSAFT_CORE_EXE` apuntando a otro.

## 6. Trampas conocidas del harness

- `chromium.connectOverCDP` **cuelga** contra este build de Electron. Se usa `_electron.launch`.
- Playwright **recicla el worker tras cada test fallido** → el `.exe` relanza (~3 min). Mitigado con
  `retries`, teardown acotado y `irARuta()` (goto con reintento).
- `GET /admin/auditoria` tiene tope `limit=100`; la escritura de auditoría no es síncrona → polling.
- `GET /catalogo` filtra `area_id`/`ubicacion_id NOT NULL`: un activo sin ubicación no aparece ahí
  a propósito.
- Escritura con una `organizacionId` donde el operador no tiene rol → **403 en el borde de CIS**,
  antes de llegar al 404 interno de CORE.
