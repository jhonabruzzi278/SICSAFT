# Empaquetado como instalador `.exe` (Inno Setup)

`sicsaft-onprem.iss` empaqueta `devops/onprem/` + `instalar-cliente.ps1` en un instalador
Windows con una UI simple de 2 pantallas (nombre del cliente/id de organización, nivel de
producto) que al terminar corre `instalar-cliente.ps1` con esos datos.

## ⚠️ Estado real — no verificado todavía

Este `.iss` **no fue compilado ni probado** en la sesión donde se escribió (no había Inno Setup
Compiler disponible en ese entorno). Es código fuente listo para compilar, no un `.exe`
verificado. Antes de usarlo con un cliente pagante:

1. Instalar [Inno Setup](https://jrsoftware.org/isinfo.php) en una máquina Windows.
2. Compilar: `iscc sicsaft-onprem.iss` (desde esta carpeta) — genera
   `output/sicsaft-onprem-setup.exe`.
3. Correr el instalador en una **VM Windows limpia** (sin WSL2/Podman preinstalados — si se prueba
   en la máquina de desarrollo, que ya tiene todo instalado, no se está probando la ruta real de
   un cliente nuevo).
4. Confirmar que:
   - La UI del wizard pide los 3 datos y los pasa bien a `instalar-cliente.ps1` (revisar los
     parámetros con los que arranca la ventana de PowerShell al final).
   - `instalar-cliente.ps1` corre de punta a punta — este script en sí tampoco fue verificado
     contra una instalación real (ver su propio encabezado y el de
     `devops/onprem/lib/Bootstrap-Zitadel.psm1`).
   - El PAT auto-provisionado por Zitadel (`ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*`/`PATPATH`, ver
     `docker-compose.yml`) efectivamente aparece en `.bootstrap/admin-pat.txt` con el contenido
     esperado (texto plano del PAT) — es una config real y documentada de Zitadel (ver
     `aidlc-docs/devops/design-artifacts/ARCHITECTURE.md`), pero nunca se corrió contra este
     compose específico.

Si algo de lo anterior no coincide con lo esperado, corregir el script/`.iss` correspondiente —
no hay que rehacer el diseño, es normal que el primer intento de automatizar un flujo así tenga
ajustes menores al chocar con la realidad de un entorno Windows concreto.

## Qué NO cubre este instalador

- No verifica licencia ni activación por cliente — eso sigue siendo una decisión de negocio fuera
  de este repo (ver `aidlc-docs/devops/requirements/REQUIREMENTS.md` INST-Q-03).
- No tiene un desinstalador que limpie contenedores/volúmenes de Podman — `[UninstallDelete]` solo
  borraría los archivos copiados, no el estado de Podman. Si se necesita un desinstalador limpio,
  es un incremento aparte.
- No firma el `.exe` (code signing) — Windows SmartScreen probablemente lo marque como "editor
  desconocido" la primera vez que se ejecute en el PC del cliente. Aceptable para instalación
  presencial/asistida (el técnico lo ejecuta él mismo), a revisar si algún día se distribuye para
  que el cliente lo instale solo.
