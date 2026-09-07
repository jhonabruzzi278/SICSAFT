# Empaquetado como Instalador `.exe` (Inno Setup)

`sicsaft-onprem.iss` empaqueta la suite `devops/onprem/` junto a `instalar-cliente.ps1` en un instalador Windows ejecutable con interfaz paso a paso.

## Objetivo

Permitir la instalación asistida en servidores o PCs Windows del cliente configurando nombre de organización, identificador y nivel de producto (Nivel 1 o Nivel 2).

## Compilación del Instalador

1. Instalar [Inno Setup 6](https://jrsoftware.org/isinfo.php).
2. Compilar el script desde este directorio:
   ```powershell
   iscc sicsaft-onprem.iss
   ```
3. El instalador resultante se genera en `output/sicsaft-onprem-setup.exe`.

## Flujo de Ejecución del Wizard

1. Solicita el nombre comercial del cliente y el identificador de organización.
2. Selecciona el nivel de producto contratado (Nivel 1 o Nivel 2).
3. Despliega los archivos y ejecuta `instalar-cliente.ps1` en modo desatendido.
4. Realiza el bootstrap automático de Keycloak 26 y levanta el stack Podman.

## Alcance y Consideraciones

- **Privilegios**: Requiere ejecución con permisos de Administrador para configurar WSL2 y Podman.
- **Red LAN**: Requiere asignación de IP estática o reserva DHCP para acceso de terminales móviles (APP QR).

## Documentos Relacionados

- [`../README.md`](../README.md) — Documentación del stack on-premise.
- [`../../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md`](../../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Estándar de identidad Keycloak.

