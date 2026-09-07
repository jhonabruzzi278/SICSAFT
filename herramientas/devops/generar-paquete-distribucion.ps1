<#
.SYNOPSIS
    Genera el paquete ZIP oficial de distribucion para la prueba del sistema SICSAFT v1.0.0.
#>

[CmdletBinding()]
param(
    [string]$Version = (Get-Content (Join-Path $PSScriptRoot '..\..\VERSION') -Raw).Trim(),
    [switch]$BuildInstaller
)

$ErrorActionPreference = 'Stop'

$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$distDir = Join-Path $raiz 'dist-paquete'
$zipName = ('SICSAFT-v{0}-Windows-OnPremise.zip' -f $Version)
$zipPath = Join-Path $raiz $zipName

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host (' SICSAFT — Generacion de Paquete de Distribucion v{0}' -f $Version) -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

# 1. Compilar instalador si se solicita
if ($BuildInstaller) {
    Write-Host 'Compilando instalador .exe de sicsaft-core con Bun...' -ForegroundColor Yellow
    Push-Location (Join-Path $raiz 'sicsaft-core')
    try {
        bun run dist:win
    } finally {
        Pop-Location
    }
}

# 2. Preparar carpeta temporal
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force | Out-Null
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

Write-Host 'Copiando archivos al paquete de distribucion...' -ForegroundColor Cyan

# Copiar ejecutable instalador si existe
$releaseDir = Join-Path $raiz 'sicsaft-core\release'
if (Test-Path $releaseDir) {
    $exeFiles = Get-ChildItem -Path $releaseDir -Filter '*.exe'
    foreach ($f in $exeFiles) {
        Write-Host (' -> Instalador: ' + $f.Name) -ForegroundColor Green
        Copy-Item $f.FullName -Destination $distDir
    }
}

# Copiar scripts de utilidad y soporte
$herramientasDest = Join-Path $distDir 'herramientas'
New-Item -ItemType Directory -Path $herramientasDest -Force | Out-Null
Copy-Item (Join-Path $raiz 'herramientas\devops\configurar-firewall-sicsaft.ps1') -Destination $herramientasDest
Copy-Item (Join-Path $raiz 'herramientas\devops\respaldo-bpi.ps1') -Destination $herramientasDest

# Copiar manuales y documentos
Copy-Item (Join-Path $raiz 'sicsaft-core\RUNBOOK-INSTALACION.md') -Destination $distDir
Copy-Item (Join-Path $raiz 'CHANGELOG.md') -Destination $distDir
Copy-Item (Join-Path $raiz 'VERSION') -Destination $distDir

# Generar Checksums SHA256
Write-Host 'Calculando hashes criptograficos SHA256...' -ForegroundColor Cyan
$checksumFile = Join-Path $distDir 'CHECKSUMS.sha256'
Get-ChildItem -Path $distDir -File | ForEach-Object {
    $hash = Get-FileHash -Path $_.FullName -Algorithm SHA256
    $linea = '{0}  {1}' -f $hash.Hash, $_.Name
    $linea | Out-File -FilePath $checksumFile -Append -Encoding utf8
}

# 3. Comprimir a archivo ZIP
Write-Host ('Generando archivo ZIP: ' + $zipName + '...') -ForegroundColor Cyan
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
$contenidoDist = Join-Path $distDir '*'
Compress-Archive -Path $contenidoDist -DestinationPath $zipPath -Force

# Limpiar carpeta temporal
Remove-Item $distDir -Recurse -Force | Out-Null

$zipItem = Get-Item $zipPath
$tamMb = [math]::Round($zipItem.Length / 1048576, 2)

Write-Host ''
Write-Host '==========================================================' -ForegroundColor Green
Write-Host ' Paquete de distribucion generado exitosamente:' -ForegroundColor Green
Write-Host (' Archivo: {0} ({1} MB)' -f $zipPath, $tamMb) -ForegroundColor White
Write-Host '==========================================================' -ForegroundColor Green
