# Guía Oficial de Control de Versiones — SICSAFT

Esta guía define el estándar de versionado, convención de commits y ciclo de releases para el ecosistema **SICSAFT**.

---

## 1. Estándar de Versionado Semántico (SemVer 2.0.0)

El proyecto SICSAFT maneja un esquema unificado de versión:
```
vMAJOR.MINOR.PATCH (ej. v1.0.0)
```

| Nivel | Cuándo incrementarlo | Ejemplo |
|---|---|---|
| **`MAJOR`** | Cambios que rompen compatibilidad pública, reestructuración mayor o avance a Nivel 3 (RFID masivo). | `1.0.0` → `2.0.0` |
| **`MINOR`** | Nuevas funcionalidades retrocompatibles (nuevos reportes, módulos del CIP, conectores). | `1.0.0` → `1.1.0` |
| **`PATCH`** | Corrección de bugs, optimizaciones de rendimiento y parches de seguridad. | `1.0.0` → `1.0.1` |

---

## 2. Convención de Commits (Conventional Commits)

Cada commit debe seguir la convención estructurada y asociar el ID de issue en Linear cuando corresponda:

```text
<tipo>(<subsistema>): <descripción corta en imperativo> [JON-XX]
```

### Tipos Oficiales:
- `feat`: Nueva funcionalidad para el usuario final o API pública.
- `fix`: Corrección de un bug.
- `docs`: Modificación o adición de documentación (`README.md`, manuales).
- `refactor`: Refactorización de código que no altera el comportamiento.
- `test`: Añadir o modificar tests unitarios, e2e o de contrato.
- `perf`: Mejora de rendimiento o uso de recursos.
- `chore`: Tareas de build, dependencias o tooling.

### Subsistemas Válidos:
- `core`: Motor Patrimonial NestJS.
- `cis`: Centro de Interoperabilidad (API Gateway).
- `ccp`: Centro de Control Patrimonial (Portal Web).
- `cip`: Centro de Inteligencia Patrimonial (Worker / Dashboards).
- `app-qr`: Aplicación de captura móvil PWA.
- `sicsaft-core`: Instalador de escritorio `.exe` (Electron).
- `devops`: Scripts de despliegue, Docker/Podman, Keycloak.
- `auditoria`: Hallazgos de calidad y arquitectura (`DOC-032`).

---

## 3. Comandos para Gestionar Versiones

El proyecto cuenta con herramientas automatizadas en `herramientas/versionado/`:

### Consultar estado de versiones en todos los subsistemas:
```powershell
.\herramientas\versionado\actualizar-version.ps1 -Status
```

### Sincronizar todos los paquetes con el archivo `VERSION` raíz:
```powershell
.\herramientas\versionado\actualizar-version.ps1 -Sync
```

### Fijar una versión específica:
```powershell
.\herramientas\versionado\actualizar-version.ps1 -Set 1.0.0
```

### Incrementar versión (Bump):
```powershell
# Subir parche (1.0.0 -> 1.0.1)
.\herramientas\versionado\actualizar-version.ps1 -Bump patch

# Subir versión menor (1.0.0 -> 1.1.0)
.\herramientas\versionado\actualizar-version.ps1 -Bump minor

# Subir versión mayor con tag de git automático
.\herramientas\versionado\actualizar-version.ps1 -Bump major -Tag
```

---

## 4. Registro de Cambios (`CHANGELOG.md`)

Cada release debe registrarse en el archivo [`CHANGELOG.md`](../../CHANGELOG.md) en la raíz bajo las categorías estándar de **Keep a Changelog**:
- `### Added`: Nuevas características.
- `### Changed`: Cambios en la funcionalidad existente.
- `### Fixed`: Corrección de bugs.
- `### Removed`: Características eliminadas o deprecadas.
- `### Security`: Parches de vulnerabilidades.
