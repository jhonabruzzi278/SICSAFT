<#
.SYNOPSIS
    Firma digital de binarios e instaladores Windows (.exe, .iss) para SICSAFT CORE.
    Cumple con el requisito EXE-08 (INST-2) para evitar bloqueos de Windows SmartScreen.

.DESCRIPTION
    Este script firma digitalmente el ejecutable de instalación de SICSAFT CORE utilizando
    un certificado Authenticode (archivo .pfx con clave privada o certificado instalado en el almacén de Windows).

.PARAMETER RutaInstalador
    Ruta al archivo .exe a firmar (ej: release\SICSAFT CORE Setup 1.0.0.exe).

.PARAMETER CertificadoPfx
    Ruta al archivo .pfx con el certificado de firma de código (opcional si se usa thumbprint).

.PARAMETER Password
    Contraseña del archivo .pfx.

.PARAMETER Thumbprint
    Huella digital del certificado instalado en Cert:\CurrentUser\My (opcional si se usa PFX).

.PARAMETER TimestampServer
    Servidor de sellado de tiempo RFC 3161 (default: http://timestamp.digicert.com).

.EXAMPLE
    .\herramientas\devops\firmar-instalador.ps1 -RutaInstalador "sicsaft-core\release\SICSAFT CORE Setup 1.0.0.exe" -CertificadoPfx "C:\certs\sicsaft-codesign.pfx" -Password "MiPassword123"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RutaInstalador,

    [Parameter(Mandatory = $false)]
    [string]$CertificadoPfx,

    [Parameter(Mandatory = $false)]
    [string]$Password,

    [Parameter(Mandatory = $false)]
    [string]$Thumbprint,

    [Parameter(Mandatory = $false)]
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🔏 [EXE-08] Iniciando proceso de firma digital para: $RutaInstalador" -ForegroundColor Cyan

if (-not (Test-Path $RutaInstalador)) {
    throw "El archivo especificado no existe: $RutaInstalador"
}

# Buscar signtool.exe en el sistema (Windows SDK / Visual Studio)
$signtool = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue | 
    Sort-Object FullName -Descending | 
    Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
    # Fallback a PATH
    $signtool = (Get-Command "signtool.exe" -ErrorAction SilentlyContinue).Source
}

if (-not $signtool) {
    Write-Warning "signtool.exe no encontrado en el sistema. Utilizando Set-AuthenticodeSignature de PowerShell nativo."
    
    if ($CertificadoPfx) {
        $cert = Get-PfxCertificate -FilePath $CertificadoPfx
    } elseif ($Thumbprint) {
        $cert = Get-Item "Cert:\CurrentUser\My\$Thumbprint"
    } else {
        throw "Debe proporcionar -CertificadoPfx o -Thumbprint para firmar el binario."
    }

    $res = Set-AuthenticodeSignature -FilePath $RutaInstalador -Certificate $cert -TimestampServer $TimestampServer -HashAlgorithm "SHA256"
    
    if ($res.Status -eq "Valid") {
        Write-Host "✅ Binario firmado exitosamente (PowerShell Authenticode): Status = $($res.Status)" -ForegroundColor Green
    } else {
        Write-Warning "Aviso: Firma completada con estado: $($res.Status) - $($res.StatusMessage)"
    }
    exit 0
}

Write-Host "🛠️ Utilizando SignTool: $signtool" -ForegroundColor Gray

# Construcción de argumentos de SignTool
$signArgs = @("sign", "/fd", "SHA256", "/tr", $TimestampServer, "/td", "SHA256", "/v")

if ($CertificadoPfx) {
    $signArgs += @("/f", $CertificadoPfx)
    if ($Password) {
        $signArgs += @("/p", $Password)
    }
} elseif ($Thumbprint) {
    $signArgs += @("/sha1", $Thumbprint, "/sm")
} else {
    throw "Debe proporcionar -CertificadoPfx o -Thumbprint."
}

$signArgs += $RutaInstalador

Write-Host "🚀 Ejecutando signtool..." -ForegroundColor Gray
& $signtool $signArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 [EXE-08] Instalador firmado exitosamente y protegido contra SmartScreen." -ForegroundColor Green
} else {
    throw "Error al firmar con signtool. Código de salida: $LASTEXITCODE"
}
