<#
.SYNOPSIS
    Configuración de Reglas de Entrada de Windows Defender Firewall para SICSAFT.
.DESCRIPTION
    Habilita los puertos de red local (LAN/WiFi) necesarios para que los teléfonos móviles,
    la PC del Profesional de AFT y las terminales de escaneo puedan conectarse con la PC madre
    (donde corre sicsaft-core.exe). Requiere ejecutarse con privilegios de Administrador.

    Camino recomendado: el instalador NSIS crea estas reglas solo si se instala "para todos
    los usuarios" (DOC-028 Fase G.5, scripts/installer.nsh). Este script es el respaldo manual
    para una instalacion por usuario, o para reponer reglas borradas.
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SICSAFT — Configuración de Firewall de Windows (LAN/WiFi)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Solo perfiles Privado y Dominio: nunca abrir estos puertos en una red Publica
# (revision de seguridad DOC-028 Fase G).
$perfil = "Private,Domain"

$reglas = @(
    @{
        Name        = "SICSAFT-PWA-Móvil"
        DisplayName = "SICSAFT - PWA Móvil y Servidor HTTPS"
        Protocol    = "TCP"
        Port        = "8765"
        Description = "Permite a los operadores acceder a la APP QR PWA y descargar el APK vía HTTPS en LAN."
    },
    @{
        Name        = "SICSAFT-CCP-Puesto-AFT"
        DisplayName = "SICSAFT - CCP del puesto del Profesional de AFT"
        Protocol    = "TCP"
        Port        = "8767"
        Description = "Permite abrir el CCP por HTTPS desde la PC del Profesional de AFT (DOC-028 Fase G)."
    },
    @{
        Name        = "SICSAFT-Keycloak-OIDC"
        DisplayName = "SICSAFT - Keycloak Auth Server"
        Protocol    = "TCP"
        Port        = "58080"
        Description = "Permite el flujo de autenticación OIDC y renovación de tokens JWT desde dispositivos móviles."
    },
    @{
        Name        = "SICSAFT-CIS-API"
        DisplayName = "SICSAFT - CIS API Gateway"
        Protocol    = "TCP"
        Port        = "56000"
        Description = "Permite a la APP QR consultar el catálogo de activos y enviar las sesiones de inventario."
    },
    @{
        Name        = "SICSAFT-Descubrimiento-UDP"
        DisplayName = "SICSAFT - Descubrimiento automático (UDP)"
        Protocol    = "UDP"
        Port        = "58765"
        Description = "Permite que la APK descubra automáticamente la PC madre en la red local."
    }
)

foreach ($r in $reglas) {
    Write-Host "Configurando regla: $($r.DisplayName) (Puerto $($r.Protocol) $($r.Port))..." -NoNewline

    # Eliminar regla previa si existiera para evitar duplicados
    Get-NetFirewallRule -Name $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

    # Crear nueva regla de entrada
    New-NetFirewallRule `
        -Name $r.Name `
        -DisplayName $r.DisplayName `
        -Description $r.Description `
        -Direction Inbound `
        -Protocol $r.Protocol `
        -LocalPort $r.Port `
        -Action Allow `
        -Profile $perfil `
        -Enabled True | Out-Null

    Write-Host " [HABILITADO]" -ForegroundColor Green
}

Write-Host "`nVerificando IP de red local (LAN):" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and $_.IPAddress -notlike "169.254.*" }
foreach ($ip in $ips) {
    Write-Host " -> Adaptador: $($ip.InterfaceAlias) | IP: $($ip.IPAddress)" -ForegroundColor White
}

Write-Host "`nTodas las reglas de Firewall para SICSAFT han sido configuradas correctamente." -ForegroundColor Green
Write-Host "Reglas creadas solo para perfiles Privado y Dominio (no Publico)." -ForegroundColor Yellow
Write-Host "  - Telefonos (APP QR):            https://<IP>:8765" -ForegroundColor Yellow
Write-Host "  - PC del Profesional de AFT (CCP): https://<IP>:8767" -ForegroundColor Yellow
Write-Host "Si la red figura como 'Publica', cambiarla a 'Privada' o las reglas no aplican." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
