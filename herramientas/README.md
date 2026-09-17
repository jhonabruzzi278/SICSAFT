# herramientas/ — Tooling de operador (no desplegable)

Scripts y apps de escritorio que corren del lado del operador o empaquetados dentro de otro
sistema — ninguno tiene su propio contenedor/CI (ver [CLAUDE.md](../CLAUDE.md) "Excepciones que no
son desplegables").

| Carpeta / archivo | Qué es | Estado |
|---|---|---|
| [`etl-contable/`](etl-contable) | ETL Python del Excel contable (DOC-029 RF-B), invocado por `sicsaft-core` | 🟢 Real, en producción |
| [`generador-qr/`](generador-qr) | App de escritorio Electron que genera e imprime etiquetas QR/Code 128 de activos — extraída de `ccp/` (DOC-029 RF-F, 2026-09-13). Corre desconectada, reusa el ETL contable como subproceso local | 🟢 Real, tiene [su propio README](generador-qr/README.md) |
| [`revision-codigo/`](revision-codigo) | Auditoría de calidad/duplicación de código (DOC-032) | 🟢 Real, en uso |
| [`devops/`](devops) | Scripts PowerShell de soporte del **instalador `sicsaft-core.exe`**: respaldo de emergencia de la BPI (`respaldo-bpi.ps1`), apertura de firewall LAN (`configurar-firewall-sicsaft.ps1`), firma Authenticode (`firmar-instalador.ps1`), empaquetado del ZIP de distribución (`generar-paquete-distribucion.ps1`). No confundir con [`devops/`](../devops) raíz (stack on-premise Podman/Docker Compose) | 🟢 Real |
| [`versionado/`](versionado) | Gestor de versionado semántico centralizado (`version-manager.mjs`/`actualizar-version.ps1`) — sincroniza `VERSION` raíz con el `package.json` de cada subsistema; convención de commits en `GUIA-CONTROL-VERSIONES.md` | 🟢 Real |
| [`limpiar-datos-cero.mjs`](limpiar-datos-cero.mjs) | Resetea a 0 los fixtures/catálogos mock de `app-qr-sicsaft/` y `ccp/` (solo demo/e2e con MSW, nunca toca la BPI real) | 🟢 Script de un solo uso |
| [`sincronizar-demo-excel.mjs`](sincronizar-demo-excel.mjs) | Regenera esos mismos fixtures mock a partir de un Excel real de `ejemplo activos/`, vía el ETL contable en modo dry-run | 🟢 Script de un solo uso |
