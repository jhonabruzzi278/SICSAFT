# Empaquetado como instalador `.exe` (Inno Setup)

`sicsaft-onprem.iss` empaqueta `devops/onprem/` + `instalar-cliente.ps1` en un instalador
Windows con una UI simple de 2 pantallas (nombre del cliente/id de organización, nivel de
producto) que al terminar corre `instalar-cliente.ps1` con esos datos.

## Estado real — verificado corriendo, pendiente solo la VM limpia

Corrección 2026-08-25: la versión anterior de esta nota decía "no fue compilado ni probado", pero
eso quedó desactualizado apenas se corrigió el bug de `$PSScriptRoot` vacío (ver comentario del
`[Run]` en `sicsaft-onprem.iss`, commit `72c15ec`) — ese hallazgo solo pudo salir de correr el
`.exe` ya compilado, no el `.ps1` suelto. El `.exe` **sí se compiló y se corrió al menos una vez**,
y `instalar-cliente.ps1` (el script que corre al final) está verificado corriendo de punta a punta
contra Windows real varias veces, con bugs reales encontrados y corregidos en el camino (ver
`devops/onprem/README.md` "Instalación automatizada" para la lista completa).

**Lo que sigue sin correrse**: el instalador `.exe` empaquetado contra una **VM Windows limpia**
(sin WSL2/Podman preinstalados). Todas las corridas verificadas hasta ahora fueron sobre una
máquina de desarrollo que ya tenía las herramientas instaladas — no se probó todavía la ruta real
de un cliente nuevo desde cero. Antes de usarlo con un cliente pagante:

1. Instalar [Inno Setup](https://jrsoftware.org/isinfo.php) en una máquina Windows (si hace falta
   recompilar — `output/sicsaft-onprem-setup.exe` ya existe de una corrida anterior).
2. Compilar: `iscc sicsaft-onprem.iss` (desde esta carpeta) — genera
   `output/sicsaft-onprem-setup.exe`.
3. Correr el instalador en una **VM Windows limpia** (sin WSL2/Podman preinstalados) — es el único
   escenario que todavía no se verificó.
4. Confirmar que:
   - La UI del wizard pide los 3 datos y los pasa bien a `instalar-cliente.ps1` (ya verificado en
     una corrida anterior — confirmar que sigue así tras cualquier cambio nuevo).
   - `instalar-cliente.ps1` corre de punta a punta también quedando WSL2/Podman por instalar desde
     cero (las corridas anteriores ya tenían ambos preinstalados).
   - El PAT auto-provisionado por Zitadel (`ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*`/`PATPATH`, ver
     `docker-compose.yml`) aparece en `.bootstrap/admin-pat.txt` con el contenido esperado — ya
     confirmado en corridas anteriores, repetir en la VM limpia como parte de esta verificación.

Si algo de lo anterior no coincide con lo esperado, corregir el script/`.iss` correspondiente —
no hay que rehacer el diseño, es normal que automatizar un flujo así tenga ajustes menores al
chocar con la realidad de un entorno Windows concreto (como ya pasó varias veces, ver la lista de
bugs reales en `devops/onprem/README.md`).

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
