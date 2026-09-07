param(
  [string]$TeamKey = "JON",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $env:LINEAR_API_KEY) {
  Write-Error "LINEAR_API_KEY environment variable is not defined."
  exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventarioScript = Join-Path $scriptDir "inventario.mjs"
$linearScript = Join-Path $scriptDir "linear-sync.mjs"

Write-Host "1. Recalculando inventario y actualizando grafo HTML..." -ForegroundColor Cyan
node $inventarioScript --grafo

Write-Host ""
Write-Host "2. Sincronizando con Linear (Equipo: $TeamKey)..." -ForegroundColor Cyan
if ($DryRun) {
  node $linearScript --team-key $TeamKey --dry-run
} else {
  node $linearScript --team-key $TeamKey --apply
}
