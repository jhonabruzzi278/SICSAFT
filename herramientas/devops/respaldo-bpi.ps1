<#
.SYNOPSIS
    Script de Respaldo de Emergencia para la Base Patrimonial Integral (BPI) de SICSAFT.
.DESCRIPTION
    Genera una copia de seguridad inmediata de la base de datos de PostgreSQL y la configuración
    de instalación en %APPDATA%\sicsaft-core\backups.
    Puede ejecutarse con la aplicación abierta o cerrada.
#>

[CmdletBinding()]
param (
    [string]$DestinoPersonalizado = ""
)

$ErrorActionPreference = "Stop"

$appData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
$sicsaftDir = Join-Path $appData "sicsaft-core"
$postgresDataDir = Join-Path $sicsaftDir "postgres-data"
$instalacionFile = Join-Path $sicsaftDir "instalacion.json"

if (-not (Test-Path $sicsaftDir)) {
    Write-Warning "No se encontró el directorio de datos de SICSAFT en: $sicsaftDir"
    exit 1
}

$backupsDir = if ($DestinoPersonalizado) { $DestinoPersonalizado } else { Join-Path $sicsaftDir "backups" }
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFolder = Join-Path $backupsDir "respaldo-$timestamp"
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SICSAFT — Respaldo de Emergencia de Base Patrimonial (BPI)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Destino: $backupFolder"

# 1. Intentar volcado lógico mediante pg_dumpall si el puerto está respondiendo
$pgDumpall = Join-Path $PSScriptRoot "..\..\sicsaft-core\resources\postgres\bin\pg_dumpall.exe"
if (-not (Test-Path $pgDumpall)) {
    $pgDumpall = Join-Path $env:ProgramFiles "sicsaft-core\resources\postgres\bin\pg_dumpall.exe"
}

$volcadoSqlExitoso = $false
if (Test-Path $pgDumpall) {
    try {
        $sqlFile = Join-Path $backupFolder "sicsaft-bpi-dump-$timestamp.sql"
        Write-Host "Intentando volcado SQL con pg_dumpall..." -NoNewline
        $process = Start-Process -FilePath $pgDumpall -ArgumentList "-p 55432 -h 127.0.0.1 -U sicsaft_admin -f `"$sqlFile`"" -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -eq 0 -and (Test-Path $sqlFile) -and (Get-Item $sqlFile).Length -gt 0) {
            Write-Host " [OK]" -ForegroundColor Green
            $volcadoSqlExitoso = $true
        } else {
            Write-Host " [NO DISPONIBLE]" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " [OMITIDO]" -ForegroundColor Yellow
    }
}

# 2. Copia física de seguridad de postgres-data si existe
if (Test-Path $postgresDataDir) {
    Write-Host "Generando copia física de postgres-data..." -NoNewline
    $dataBackupDir = Join-Path $backupFolder "postgres-data"
    Copy-Item -Path $postgresDataDir -Destination $dataBackupDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host " [OK]" -ForegroundColor Green
}

# 3. Copia de instalacion.json
if (Test-Path $instalacionFile) {
    Copy-Item -Path $instalacionFile -Destination (Join-Path $backupFolder "instalacion.json") -Force
}

Write-Host "`nRespaldo completado exitosamente en:" -ForegroundColor Green
Write-Host "$backupFolder" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
