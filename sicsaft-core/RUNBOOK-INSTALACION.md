# Runbook — instalar y operar `sicsaft-core.exe` en un cliente (Nivel 2 / Modo Profesional)

Ciclo de vida completo en la PC de un cliente: **instalar** (§1–§6), **actualizar** a una versión
nueva (§9) y **respaldar / restaurar** los datos (§10). Camino `.exe` (Electron, sin
Podman/Docker/WSL2). Para el camino Podman ver
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
| Sin auto-update | Actualizar = correr el instalador nuevo encima (§9). No hay "buscar actualizaciones". |
| Sin backup automático | El respaldo de `%APPDATA%\sicsaft-core\` es manual / tarea programada (§10). |
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

---

## 9. Actualizar una instalación existente

**No hay auto-update.** Es una decisión de diseño (DOC-030: "instalación autocontenida, sin canal
de conexión del proveedor al cliente"). Actualizar = **correr el instalador nuevo encima** del
viejo. Funciona sin perder datos porque el estado vive aparte de la carpeta de programa:

| Se **preserva** (en `%APPDATA%\sicsaft-core\`) | Se **reemplaza** (carpeta de instalación) |
|---|---|
| `postgres-data\` — la base entera: BPI (activos, contratos, auditoría…) **y** el realm de Keycloak | Los binarios de la app + Electron + Postgres/Keycloak/JRE/Python vendorizados |
| `keycloak-admin.json` · `instalacion.json` · `appqr-tls\` | El build de Keycloak (`kc.bat build`, horneado al empaquetar) |

Al arrancar, `service-orchestrator` corre las migraciones de `core` y `cip` **en cada inicio**
(`node-pg-migrate`, idempotente) → los cambios de esquema de la versión nueva se aplican solos
sobre los datos existentes. El wizard se saltea (detecta `instalacion.json`).

### 9.1 Pasos

1. **En dev**: subir `version` en `sicsaft-core/package.json` (ej. `0.1.0` → `0.1.1`); si cambió la
   APK, subir `versionCode`/`versionName` en `apk-aft/app/build.gradle.kts`. Después
   `npm run dist:win` → `release/SICSAFT CORE Setup 0.1.1.exe`.
2. **Llevar el `.exe`** al cliente (USB / link).
3. **En la PC del cliente — primero el backup** (§10). Es la única red de seguridad: la app solo
   corre migraciones `up`, no hay rollback automático.
4. **Cerrar la app** por completo (que Postgres/Keycloak apaguen limpio — lo hace en `before-quit`).
5. **Ejecutar el instalador nuevo.** SmartScreen → **Más información → Ejecutar de todos modos**.
   UAC. Instala sobre la versión vieja (mismo `appId` `cl.sicsaft.core`). **No desinstalar
   primero** — solo correr el nuevo encima.
6. **Abrir la app.** Levanta Postgres contra `postgres-data\` existente → aplica migraciones
   nuevas → Keycloak contra el realm existente → **directo al login**, sin wizard. Si la IP de LAN
   cambió, primero la pantalla de reconfiguración de 1 clic.
7. **Teléfonos**: la PWA se sirve fresca desde el `.exe`, se actualiza sola. La **APK no
   auto-actualiza** (DOC-029 H.3) — si su contrato con CIS cambió, resideloadear la APK nueva.

### 9.2 Verificación post-update

- **Versión instalada**: Configuración de Windows → Aplicaciones → "SICSAFT CORE" (el instalador
  NSIS la registra ahí). No se muestra dentro de la app.
- Login del Directivo y del Profesional de AFT OK.
- Un activo conocido sigue en el catálogo; la Auditoría conserva el historial.
- Si algo quedó mal → restaurar el backup (§10.3) y no reintentar el update hasta entender qué
  migración falló.

### 9.3 Naturaleza de la operación

Es una **visita asistida del proveedor** (o sesión remota guiada), igual que "más sedes / cambios
de contrato" en §7 — no hay botón de "buscar actualizaciones". Un auto-update de verdad
(`electron-updater` + un `publish` target: servidor HTTP propio, S3 o GitHub Releases + wiring en
`index.ts`) **reabre** la decisión de DOC-030 (un auto-updater ES un canal proveedor→cliente) →
necesita un ADR antes de implementarse.

---

## 10. Backup y restauración

No hay mecanismo integrado — es copiar carpetas. Todo el estado del cliente está en
**`%APPDATA%\sicsaft-core\`**.

### 10.1 Qué respaldar

| Carpeta / archivo | Crítico | Por qué |
|---|---|---|
| `postgres-data\` | **Sí** | La base entera. Incluye el realm de Keycloak (usuarios, roles, organización) — no hay que re-bootstrapear al restaurar. |
| `keycloak-admin.json` | **Sí** | El admin de Keycloak se creó con **ese** password. Restaurar `postgres-data` con otro `keycloak-admin.json` (o sin él) = la app no puede autenticarse contra el realm restaurado. Va **siempre junto** con `postgres-data`. |
| `instalacion.json` | Recomendado | Sin él, el próximo arranque vuelve a mostrar el wizard. Recuperable a mano, pero mejor incluirlo. |
| `appqr-tls\` | Opcional | El cert autofirmado; si falta se regenera solo (el teléfono tendrá que re-aceptar el aviso una vez). |

Lo simple y sin errores: **copiar la carpeta `%APPDATA%\sicsaft-core\` entera.**

### 10.2 Cómo y cuándo

- **Con la app cerrada.** Postgres tiene locks sobre `postgres-data\`; copiar en caliente puede
  dar un backup inconsistente.
- **Antes de cada update** (§9 paso 3), y idealmente **periódico**: una Tarea Programada de Windows
  que, con la app cerrada de madrugada, copie `%APPDATA%\sicsaft-core\` a un disco externo o
  carpeta de red, rotando algunas copias.
- Alternativa en caliente (sin cerrar la app): `pg_dump` con el binario vendorizado
  `…\resources\postgres\bin\pg_dump.exe` contra `127.0.0.1:55432` (Postgres embebido, puerto no
  estándar). Más frágil y no cubre `keycloak-admin.json` — la copia en frío de la carpeta es lo
  recomendado.

### 10.3 Restaurar en la misma PC

1. Cerrar la app.
2. Renombrar `%APPDATA%\sicsaft-core\` a `…\sicsaft-core.roto`.
3. Copiar el backup a `%APPDATA%\sicsaft-core\`.
4. Abrir la app → vuelve exactamente al estado del backup.

### 10.4 Restaurar en otra PC (la del cliente se murió)

1. Instalar el `.exe` (misma versión que el backup, o más nueva) — §2.
2. Dejar que abra y **cerrarla apenas termine el arranque** (o antes del wizard).
3. Reemplazar `%APPDATA%\sicsaft-core\` con el backup (mismo criterio que §10.3).
4. Reabrir. Si la PC nueva tiene otra IP de LAN → pantalla de reconfiguración de 1 clic al
   arrancar; después, reserva DHCP para la IP nueva y (si hace falta) el 2º QR para los teléfonos.
5. Si el `.exe` es más nuevo que el backup, las migraciones de esa versión corren sobre los datos
   restaurados en el primer arranque (igual que en un update, §9).
