# SICSAFT — Despliegue On-Premise por Cliente

Stack de contenedores Podman / Docker para desplegar una instancia **aislada** de SICSAFT en la infraestructura del cliente (on-premise).

## Objetivo

Proveer el entorno local completo por cliente para ejecutar SICSAFT en sus modalidades:
- **Nivel 1**: APP QR + CCP completo + Directivo + Admin + CIP (sin dashboard analítico).
- **Nivel 2**: Nivel 1 + Dashboard analítico e indicadores de CIP activados (`VITE_SICSAFT_NIVEL=2`).

## Requisitos Previos

- Windows 10/11 con WSL2 habilitado (`wsl --install`).
- Podman Desktop o Podman CLI + `podman-compose` (o Docker Desktop en servidores).
- Hostname local configurado en `C:\Windows\System32\drivers\etc\hosts`:
  ```text
  127.0.0.1 id.sicsaft.localhost
  127.0.0.1 api.sicsaft.localhost
  127.0.0.1 qr.sicsaft.localhost
  127.0.0.1 directivo.sicsaft.localhost
  127.0.0.1 ccp.sicsaft.localhost
  ```

## Instalación Automatizada (Recomendada)

```powershell
./instalar-cliente.ps1 -ClienteNombre "Municipalidad de Melipilla" `
    -OrganizacionId "municipalidad-melipilla" -Nivel 2
```

El script ejecuta automáticamente:
1. Verificación de WSL2 y Podman.
2. Generación de `.env` con contraseñas seguras únicas.
3. Inicio de la base de datos y Keycloak 26.
4. Bootstrap de la organización, roles y clientes OIDC vía `bootstrap-keycloak.ps1`.
5. Construcción y levantamiento de los contenedores de backend y frontend.
6. Verificación de salud (smoke checks).

## Instalación Manual (Paso a Paso)

1. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   # Completar POSTGRES_ADMIN_PASSWORD, KEYCLOAK_DB_PASSWORD, CORE_SERVICE_TOKEN
   ```
2. **Iniciar base de datos e identidad**:
   ```bash
   podman-compose up -d postgres keycloak traefik
   ```
3. **Ejecutar Bootstrap de Keycloak**:
   ```powershell
   ./bootstrap-keycloak.ps1 -AdminUsername admin -AdminPassword "password-de-env" `
       -ClienteNombre "Cliente Ejemplo" -OrganizacionId "cliente-ejemplo" -Nivel 2
   ```
4. **Construir y levantar stack completo**:
   ```bash
   podman-compose up -d --build
   ```

## Mantenimiento y Parada

```bash
# Detener servicios preservando volúmenes de datos
podman-compose down

# Reset completo (elimina volúmenes y datos locales)
podman-compose down -v
```

## Documentos Relacionados

- [`installer/README.md`](installer/README.md) — Empaquetado del instalador `.exe` con Inno Setup.
- [`../../aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md`](../../aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md) — Definición de niveles de producto.
- [`../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md`](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Decisión de arquitectura de identidad Keycloak 26.

