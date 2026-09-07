<#
.SYNOPSIS
    Script de conveniencia para gestionar versiones en el ecosistema SICSAFT.

.EXAMPLE
    .\herramientas\versionado\actualizar-version.ps1 -Status
    .\herramientas\versionado\actualizar-version.ps1 -Sync
    .\herramientas\versionado\actualizar-version.ps1 -Set 1.0.0
    .\herramientas\versionado\actualizar-version.ps1 -Bump patch
    .\herramientas\versionado\actualizar-version.ps1 -Bump minor -Tag
#>

param(
    [switch]$Status,
    [switch]$Sync,
    [string]$Set,
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump,
    [switch]$Tag
)

$managerScript = Join-Path $PSScriptRoot "version-manager.mjs"

if ($Status) {
    node $managerScript status
    exit $LASTEXITCODE
}

if ($Sync) {
    if ($Tag) { node $managerScript sync --tag } else { node $managerScript sync }
    exit $LASTEXITCODE
}

if ($Set) {
    if ($Tag) { node $managerScript set $Set --tag } else { node $managerScript set $Set }
    exit $LASTEXITCODE
}

if ($Bump) {
    if ($Tag) { node $managerScript bump $Bump --tag } else { node $managerScript bump $Bump }
    exit $LASTEXITCODE
}

# Por defecto, mostrar estado
node $managerScript status
