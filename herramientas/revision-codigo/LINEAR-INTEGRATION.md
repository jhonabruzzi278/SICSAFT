# Guía de Integración con Linear (CLI & MCP) — SICSAFT

Esta guía explica cómo sincronizar el inventario, grafo de arquitectura, dependencias y hallazgos de auditoría ([DOC-032](../../aidlc-docs/revision-codigo/DOC-032-revision-de-codigo-y-documentacion.md)) con **Linear** mediante:
1. **Script CLI Automatizado (`linear-sync.mjs`)**: Exportación directa mediante Linear GraphQL API.
2. **Linear MCP Server (Model Context Protocol)**: Integración en tiempo real con el asistente de IA / Antigravity IDE.

---

## 1. Obtener la API Key de Linear

1. Inicia sesión en tu cuenta de [Linear](https://linear.app).
2. Ve a **Settings (Configuración)** → **Account** → **Security**.
3. En la sección **Personal API keys**, haz clic en **New API Key**.
4. Nómbrala `SICSAFT-CLI` (o similar) y copia el token generado (`lin_api_...`).

---

## 2. Uso de la Herramienta CLI (`linear-sync.mjs`)

El script se encuentra en `herramientas/revision-codigo/linear-sync.mjs` y permite sincronizar todo el estado del proyecto.

### Paso 1: Exportar la API Key en tu terminal

En PowerShell (Windows):
```powershell
$env:LINEAR_API_KEY="lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

En Bash / Zsh:
```bash
export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Paso 2: Consultar tus equipos disponibles

```bash
node herramientas/revision-codigo/linear-sync.mjs --teams
```

Salida esperada:
```
Equipos disponibles en Linear:
 - [SIC] SICSAFT Core Team (ID: f1234567-...)
 - [ENG] Engineering (ID: a9876543-...)
```

### Paso 3: Simulación previa (Dry Run)

```bash
node herramientas/revision-codigo/linear-sync.mjs --dry-run
```

### Paso 4: Aplicar la sincronización a Linear

```bash
node herramientas/revision-codigo/linear-sync.mjs --team-key SIC --apply
```

### Qué sincroniza automáticamente:
- **Labels de subsistema**: `sistema:cis`, `sistema:core`, `sistema:ccp`, `sistema:app-qr`, `sistema:sicsaft-core`, etc.
- **Labels de ejes de auditoría**: `eje:A`, `eje:B`, `eje:C`, `eje:D`.
- **Issues de Hallazgos (H-01 a H-08)**:
  - Título, prioridad (Urgent/High/Medium/Low según severidad).
  - Estado automático: **Done** para los resueltos (H-01 a H-05), **Todo** para los pendientes (H-06 a H-08).
  - Descripción Markdown detallada con evidencia, impacto y decisión técnica.
- **Idempotencia**: Si vuelves a correr el script, actualiza los issues existentes sin duplicarlos.

---

## 3. Automatización del Proceso

Tienes 3 formas de automatizar la sincronización según tu flujo de trabajo:

### A. Ejecución Rápida en 1-Clic (Local)
Se preparó un script PowerShell que recalcula el inventario, actualiza el grafo HTML y sincroniza Linear automáticamente:
```powershell
powershell -ExecutionPolicy Bypass -File herramientas\revision-codigo\sincronizar-linear.ps1
```

O si deseas hacer una prueba simulada sin escribir:
```powershell
powershell -ExecutionPolicy Bypass -File herramientas\revision-codigo\sincronizar-linear.ps1 -DryRun
```

---

### B. Automatización Continua con GitHub Actions (`linear-sync.yml`)
Se creó el flujo de trabajo [`.github/workflows/linear-sync.yml`](../../.github/workflows/linear-sync.yml).

Cada vez que hagas un `git push` a la rama `main` con cambios en documentación, roadmap o herramientas:
1. GitHub Actions detecta el commit.
2. Ejecuta `inventario.mjs --grafo` para refrescar las métricas del repositorio.
3. Sincroniza automáticamente los nuevos estados a tu equipo en Linear.

> **Configuración requerida en GitHub**:
> Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
> - **Name**: `LINEAR_API_KEY`
> - **Secret**: `<tu_token_linear_api>`

---

### C. Integración en Tiempo Real con Linear MCP (Model Context Protocol)

El servidor oficial de **Linear MCP** ya quedó configurado en tu archivo global (`C:\Users\jonat\.gemini\config\mcp_config.json`):

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": {
        "LINEAR_API_KEY": "<tu_token_linear_api>"
      }
    }
  }
}
```

Esto le permite a Antigravity y a los agentes de IA:
- Consultar el estado de tus issues en Linear durante el desarrollo.
- Marcar tareas como completadas automáticamente al cerrar PRs o resolver hallazgos.
- Crear nuevos requerimientos o bugs encontrados sin salir del editor.

