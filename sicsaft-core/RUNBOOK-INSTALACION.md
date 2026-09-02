# Runbook — instalar `sicsaft-core.exe` en un cliente (Nivel 2 / Modo Profesional)

Paso a paso para dejar SICSAFT corriendo en la PC de un cliente y poder mostrárselo. Camino
`.exe` (Electron, sin Podman/Docker/WSL2). Para el camino Podman ver
[`devops/onprem/README.md`](../devops/onprem/README.md).

Nomenclatura: [NOMENCLATURA.md](../NOMENCLATURA.md). Diseño del `.exe`:
[DOC-028](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) +
[DOC-030](../aidlc-docs/sicsaft-core/design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md).

---

## 0. Antes de ir — pedirle al cliente

| Qué | Por qué |
|---|---|
| Una PC **Windows 10/11 x64** que quede prendida (será el "servidor"). Idealmente la del Directivo. | Corre los 6 servicios embebidos. |
| **Permisos de administrador** en esa PC. | El instalador NSIS escribe en Archivos de Programa. |
| Esa PC y el/los teléfono(s) del Profesional de AFT en la **misma red Wi‑Fi/LAN**. | El teléfono llega a CIS y Keycloak por la IP de LAN. |
| Una **reserva DHCP** para esa PC en el router (IP fija). | Si la IP cambia hay que reconfigurar (hay flujo guiado, pero mejor evitarlo). |
| Nombre de la organización, un identificador corto, el nombre de la sede principal, y el correo del Director (y opcionalmente del Profesional de AFT). | Los pide el wizard en el primer arranque. |

## 1. Construir el instalador (desde `main`)

En la máquina de desarrollo, con `main` al día:

```bash
cd sicsaft-core
npm ci
npm run dist:win
```

- `dist:win` corre `prepack.cjs` (buildea `ccp`/`core-frontend`/`app-qr-sicsaft`/`cis`/`core`/`cip`
  + `kc.bat build` de Keycloak si falta + copia el `.apk` y el ETL contable, ver abajo) y después
  `electron-builder`. **Necesita `npm ci` en `ccp/`, `core/frontend/`, `app-qr-sicsaft/`, `cis/`,
  `core/`, `cip/`** y los binarios vendorizados en `sicsaft-core/resources/` (ver
  `resources/README.md`).
- Salida: `sicsaft-core/release/SICSAFT CORE Setup <version>.exe` (~450 MB).

### 1.1 Antes de `dist:win` — dos artefactos opcionales que el `.exe` incluye si están

| Artefacto | Cómo dejarlo listo | Si falta |
|---|---|---|
| **APK Android** (RF-H) | Bajar el `.apk` firmado del artefacto `sicsaft-aft-apk-firmada` del workflow `apk-aft` a `apk-aft/app/build/outputs/apk/release/`. `prepack.cjs` (`copiarApk`) lo copia a `resources/apk/sicsaft-aft.apk`. | `prepack` avisa y sigue; el `.exe` queda sin APK, con la PWA por navegador como único camino. |
| **Sidecar Python de ingesta contable** (RF-B.6.2) | Vendorizar `python-build-standalone` (Windows x64) + un venv con `pandas`/`xlrd`/`openpyxl`/`requests` en `sicsaft-core/resources/etl-contable/python/` (estructura y fuentes en `resources/README.md`). El script + mapeos (`app/`) los copia `prepack.cjs` solo. | `prepack` avisa y sigue; la carpeta de ingesta **no se procesa sola** — solo funciona la carga manual de CSV desde el CCP. |

> **Pendiente conocido** (DOC-028 "definición de listo para cliente final"): `dist:win` todavía no se corrió contra una PC Windows
> 100 % limpia. Si es la primera instalación real, probar el `.exe` en una VM limpia antes de ir.

## 2. Transferir e instalar en la PC del cliente

1. Copiar el `.exe` a la PC del cliente (USB o red).
2. Ejecutarlo. Windows SmartScreen va a mostrar **"Windows protegió tu PC"** (el instalador no
   está firmado). → **Más información → Ejecutar de todos modos**.
3. Aceptar el UAC. Elegir carpeta de instalación (o dejar la default). Termina y abre la app.

## 3. Primer arranque — wizard

La app levanta Postgres → Keycloak → CORE → CIP (~1–2 min la primera vez) y muestra el wizard.

1. **Paso 1 — Datos de esta instalación**
   - Nombre del cliente, identificador (se autocompleta), sede principal.
   - **Nivel contratado: elegir "Nivel 2 — Modo Profesional".** (Default es Nivel 1.) Esto habilita
     el CCP completo + el Dashboard/indicadores de CIP.
   - Continuar. Crea el realm de Keycloak + la organización/contrato/sede en la BPI y arranca CIS.
2. **Paso 2 — Director**: correo del Director. Queda con el rol `directivo` y `UPDATE_PASSWORD`
   forzado (define su clave en el primer login).
3. **Paso 3 — Profesional de AFT** (opcional): correo del Profesional de AFT (rol
   `administrador-patrimonial`). Si se salta, el Directivo lo designa después desde su portal.
4. **Paso "listo"**: aparece el login embebido de Keycloak + un **QR** para la APP QR del teléfono.
   El login detecta el rol y muestra el CCP (Profesional de AFT) o el portal Directivo.
   - En esta misma pantalla hay una tarjeta **"Carpeta de ingesta contable"** (RF-B.6.1). Elegir
     ahí la carpeta donde el especialista contable dejará los `.xls`/`.xlsx` (puede ser una
     carpeta compartida de red). Se puede fijar/cambiar después desde la franja del portal.
   - Al fijarla, si el sidecar Python está vendorizado (§1.1), arranca el **watcher** (RF-B.6.2):
     cada Excel nuevo se procesa solo → crea un lote `pendiente_revision` en el CCP. Los archivos
     procesados van a `<carpeta>/.procesados/`, los que fallan a `<carpeta>/.error/` (con un
     `.log` al lado), y todo queda en `<carpeta>/ingesta.log`. El `.exe` crea en el bootstrap un
     cliente Keycloak `sicsaft-ingesta` (service account) para esto — no requiere acción del
     operador.

Los relanzamientos saltan el wizard (via `instalacion.json`) pero **re-levantan el watcher** si
había carpeta configurada. Si la IP de LAN cambió, muestra primero la pantalla de reconfiguración
de ~1 clic.

## 4. Firewall de Windows

La primera vez que Keycloak/CIS escuchan en la IP de LAN, Windows pregunta. → **Permitir acceso**
(redes privadas). Sin esto el teléfono no llega.

## 5. Teléfono — APP QR

**Opción A — PWA por navegador (camino oficial hoy):**

1. Escanear con la cámara el QR de la pantalla "listo" → abre `https://<ip-lan>:8765`.
2. El navegador avisa **certificado no confiable** (es autofirmado, LAN). → Continuar/Avanzado →
   Acceder. Se acepta una vez y queda.
3. Login OIDC del Profesional de AFT. Ya se puede escanear activos.

**Opción B — APK Android (RF-H, si se incluyó en el `.exe`):**

El instalador ya trae `sicsaft-aft.apk` en `resources/apk/`. Servirlo desde el `.exe` en
`:8765/sicsaft-aft.apk` + un 2º QR de descarga está **pendiente** — por ahora el APK se instala a
mano: copiar el archivo al teléfono (USB/Drive), instalarlo ("permitir orígenes desconocidos"),
abrirlo, y en el primer arranque **escanear el mismo QR de conexión** de la pantalla "listo". La
WebView acepta el cert autofirmado sola (sin el aviso del navegador) — esa es la razón de la APK.

## 6. Qué mostrarle al cliente (checklist de demo)

- [ ] **Wizard** — instalación de punta a punta, elección de Nivel 2.
- [ ] **CCP (Profesional de AFT)** — login, hub de la organización. Módulos visibles en Nivel 2:
      Resumen/Dashboard, Activos (con alta manual), Importaciones, Estructura (áreas/ubicaciones/
      responsables), QR/Etiquetas, Auditoría.
- [ ] **Alta de un activo** desde el CCP → aparece en el catálogo.
- [ ] **APP QR en el teléfono** — escanear ese activo, cerrar el control de un área → **Pantalla 8**
      (informe de control: % del área, estado declarado, veredicto con color).
- [ ] **Resumen del CCP** — la sesión recién cerrada, con su Pantalla 8 desplegable.
- [ ] **Auditoría** — la operación queda registrada con usuario, área y resultado.
- [ ] **Portal Directivo** — login con la cuenta del Director → dashboard ejecutivo (CIP).
- [ ] **Importación de Excel** — dejar el `.xls` del contador en la carpeta elegida → el watcher
      lo procesa solo → revisar el lote en el CCP (Importaciones) → aprobar → los activos entran a
      la BPI. *(Requiere el sidecar Python vendorizado, §1.1. Sin él: carga manual de CSV desde el
      CCP.)*

## 7. Limitaciones conocidas (decir de entrada)

| Límite | Detalle |
|---|---|
| Instalador sin firmar | SmartScreen pide "Ejecutar de todos modos". Firma de código = pendiente. |
| Cert autofirmado en el teléfono | Aviso de seguridad la primera vez. Un cert sin aviso necesita hostname `.local` + mDNS (DOC-028 C.3, futuro). |
| Más sedes / cambios de contrato | No hay portal de administración en la PC del cliente (decisión: instalación autocontenida, sin `web_admin` ni acceso remoto — DOC-030). Es una operación asistida del proveedor. |
| Watcher de ingesta de Excel | Código completo (RF-B.6.2). Falta vendorizar el intérprete Python (§1.1) y verificar el round-trip real contra el stack. Sin el intérprete: solo carga manual de CSV. |
| APK Android | Proyecto `apk-aft/` + CI existen (RF-H) y el `.exe` la incluye en `resources/apk/` si está el artefacto firmado. Falta que el `.exe` la sirva en `:8765` + 2º QR — hoy es sideload manual del archivo (§5 opción B). |
| Claim `organization` en el token de servicio | El service account `sicsaft-ingesta` necesita que su token `client_credentials` traiga el claim `organization`; no se pudo verificar contra un Keycloak real todavía. Si falla, el POST del ETL da 403 (fallback documentado en `keycloak-bootstrap.ts`). |
| `dist:win` en PC 100 % limpia | Todavía no verificado end‑to‑end (DOC-028 "definición de listo para cliente final"). |

## 8. Si algo falla

- **Ventana en blanco / servicio caído**: la app abre DevTools sola en modo no empaquetado; en el
  `.exe` instalado, revisar `%APPDATA%\sicsaft-core\logs\`.
- **El teléfono no conecta**: verificar que están en la misma LAN, el firewall permitió, y la IP
  del QR es la de LAN (no `127.0.0.1`). Si la IP de la PC cambió, relanzar la app → pantalla de
  reconfiguración.
- **Los Excel no se procesan**: (1) ¿está vendorizado `resources/etl-contable/python/python.exe`?
  (§1.1). (2) revisar `<carpeta-de-ingesta>/ingesta.log` y los `.log` en `<carpeta>/.error/`.
  (3) un `403` del ETL contra CIS = el token de servicio no trae el claim `organization` (ver
  Limitaciones). (4) el watcher solo mira `.xls`/`.xlsx` en la raíz de la carpeta, no en
  subcarpetas.
- **Bitácora de bugs reales de toda la línea**:
  [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md).
