# Infraestructura / DevOps / Operaciones SICSAFT (capacidad transversal — OPS)

## Objetivo
Capacidad transversal de infraestructura, empaquetado, instalación y despliegue on-premise para
los sistemas del ecosistema SICSAFT (APP QR, CIS, CORE, CCP, CIP, RFID, Integraciones).

## Estado
🟢 **Entorno On-Premise / .EXE consolidado** ([`devops/onprem/`](onprem/)):
A partir de septiembre 2026 y de acuerdo a la resolución de arquitectura (DOC-032 / ADR-004),
el despliegue y distribución del sistema se consolida de forma exclusiva en el modelo
**On-Premise / Instalador .EXE** ([`sicsaft-core`](../sicsaft-core/)).

Los entornos experimentales multi-tenant en VPS (`devops/local` y `devops/prod`) fueron
formalmente retirados para enfocar el 100% del mantenimiento en el entregable del cliente.

- **Stack On-Premise** ([`devops/onprem/docker-compose.yml`](onprem/docker-compose.yml)):
  Levanta un tenant completo y aislado en el PC/servidor del cliente sobre **Podman** / Docker Compose,
  con **Keycloak 26** como proveedor de identidad OIDC, Postgres para la Base Patrimonial Inteligente (BPI)
  y Traefik como proxy local.
- **Automatización de Alta** ([`devops/onprem/bootstrap-keycloak.ps1`](onprem/bootstrap-keycloak.ps1)):
  Script de automatización para provisionar clientes OIDC, roles y usuarios en Keycloak sin pasos manuales.
- **Empaquetado**: Integrado con el instalador de Inno Setup bajo [`devops/onprem/installer/`](onprem/installer/)
  y orquestado por la aplicación de escritorio [`sicsaft-core`](../sicsaft-core/).

## Estructura

```
devops/
└── onprem/                         # instalación aislada por cliente — ver devops/onprem/README.md
    ├── docker-compose.yml          # Compose profile on-premise (Keycloak 26, Postgres, Traefik, CIS, CORE, CIP, CCP)
    ├── bootstrap-keycloak.ps1      # automatiza el alta del realm/clientes en Keycloak (ADR-004)
    ├── instalar-cliente.ps1        # script de instalación desatendida del cliente
    ├── traefik/, postgres/         # configs autocontenidas de proxy y base de datos
    ├── installer/                  # scripts y assets de empaquetado Inno Setup (.exe)
    └── .env.example                # variables de entorno para el despliegue on-prem
```

## Identidad y Seguridad (Keycloak 26)
Conforme a [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md), el proveedor de identidad
único y oficial es **Keycloak 26**, operando con flujo OIDC + PKCE. Todos los portales y backends
se autentican contra este servidor centralizado.

## Pipeline CI/CD (GitHub Actions)
```
lint + type-check
  → unit tests (100% cobertura en backends)
    → integration tests
      → SAST + secret scan
        → build del ejecutable / paquetes de distribución (.exe)
```

## Documentos relacionados
- [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — marco de arquitectura general.
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — adopción de Keycloak 26.
- [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) — bitácora de gotchas de plataforma Windows/Keycloak.
- [DOC-032](../aidlc-docs/revision-codigo/DOC-032-revision-de-codigo-y-documentacion.md) — revisión de código e instrumentación.

