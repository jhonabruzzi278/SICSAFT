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
  + `kc.bat build` de Keycloak si falta) y después `electron-builder`. **Necesita `node_modules`
  en `ccp/`, `core/frontend/`, `cis/`, `core/`, `cip/`** (`npm ci` en cada uno) y los binarios
  vendorizados en `sicsaft-core/resources/` (ver `resources/README.md`).
- Salida: `sicsaft-core/release/SICSAFT CORE Setup <version>.exe` (~450 MB).

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
   - **Nivel contratado.** El **CCP va completo en ambos niveles** (activos con alta manual,
     estructura, importaciones, etiquetas, auditoría). **Nivel 2 — Modo Profesional** agrega el
     **Dashboard/indicadores (CIP)**. (Default es Nivel 1.) Elegir según el contrato.
   - Continuar. Crea el realm de Keycloak + la organización/contrato/sede en la BPI y arranca CIS.
2. **Paso 2 — Director**: correo del Director. Queda con el rol `directivo` y `UPDATE_PASSWORD`
   forzado (define su clave en el primer login).
3. **Paso 3 — Profesional de AFT** (opcional): correo del Profesional de AFT (rol
   `administrador-patrimonial`). Si se salta, el Directivo lo designa después desde su portal.
4. **Paso "listo"**: aparece el login embebido de Keycloak + un **QR** para la APP QR del teléfono.
   El login detecta el rol y muestra el CCP (Profesional de AFT) o el portal Directivo.

Los relanzamientos saltan el wizard (via `instalacion.json`). Si la IP de LAN cambió, muestra
primero la pantalla de reconfiguración de ~1 clic.

## 4. Firewall de Windows

La primera vez que Keycloak/CIS escuchan en la IP de LAN, Windows pregunta. → **Permitir acceso**
(redes privadas). Sin esto el teléfono no llega.

## 5. Teléfono — APP QR

1. Escanear con la cámara el QR de la pantalla "listo" → abre `https://<ip-lan>:8765`.
2. El navegador avisa **certificado no confiable** (es autofirmado, LAN). → Continuar/Avanzado →
   Acceder. Se acepta una vez y queda.
3. Login OIDC del Profesional de AFT. Ya se puede escanear activos.

## 6. Qué mostrarle al cliente (checklist de demo)

- [ ] **Wizard** — instalación de punta a punta, elección de nivel.
- [ ] **CCP (Profesional de AFT)** — login, hub de la organización. Módulos del CCP (visibles en
      **todos los niveles**): Activos (con alta manual, baja, edición), Estructura
      (áreas/ubicaciones/responsables), Importaciones, QR/Etiquetas, Auditoría, Resumen.
- [ ] **Dashboard / indicadores (CIP)** — visible **solo en Nivel 2**.
- [ ] **Alta de un activo** desde el CCP → aparece en el catálogo.
- [ ] **APP QR en el teléfono** — escanear ese activo, cerrar el control de un área → **Pantalla 8**
      (informe de control: % del área, estado declarado, veredicto con color).
- [ ] **Resumen del CCP** — la sesión recién cerrada, con su Pantalla 8 desplegable.
- [ ] **Auditoría** — la operación queda registrada con usuario, área y resultado.
- [ ] **Portal Directivo** — login con la cuenta del Director → dashboard ejecutivo (CIP).
- [ ] **Importación de Excel** (si aplica) — dejar el `.xls` del contador en la carpeta elegida →
      revisar el lote en el CCP → aprobar → los activos entran a la BPI. *(Requiere el watcher de
      RF-B.6.2, que todavía no está cableado — hoy se prueba con la carga manual de CSV.)*

## 7. Limitaciones conocidas (decir de entrada)

| Límite | Detalle |
|---|---|
| Instalador sin firmar | SmartScreen pide "Ejecutar de todos modos". Firma de código = pendiente. |
| Cert autofirmado en el teléfono | Aviso de seguridad la primera vez. Un cert sin aviso necesita hostname `.local` + mDNS (DOC-028 C.3, futuro). |
| Más sedes / cambios de contrato | No hay portal de administración en la PC del cliente (decisión: instalación autocontenida, sin `web_admin` ni acceso remoto — DOC-030). Es una operación asistida del proveedor. |
| Watcher de ingesta de Excel | RF-B.6.2 pendiente — el flujo automático carpeta→ETL→staging todavía no corre en el `.exe`; la carga manual de CSV sí. |
| APK Android | No existe (DOC-028 Fase E / RF-H). El camino oficial es la PWA por QR. |
| `dist:win` en PC 100 % limpia | Todavía no verificado end‑to‑end (DOC-028 "definición de listo para cliente final"). |

## 8. Si algo falla

- **Ventana en blanco / servicio caído**: la app abre DevTools sola en modo no empaquetado; en el
  `.exe` instalado, revisar `%APPDATA%\sicsaft-core\logs\` y `ingesta.log`.
- **El teléfono no conecta**: verificar que están en la misma LAN, el firewall permitió, y la IP
  del QR es la de LAN (no `127.0.0.1`). Si la IP de la PC cambió, relanzar la app → pantalla de
  reconfiguración.
- **Bitácora de bugs reales de toda la línea**:
  [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md).
