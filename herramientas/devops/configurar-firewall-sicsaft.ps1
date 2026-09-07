<#
.SYNOPSIS
    Configuración de Reglas de Entrada de Windows Defender Firewall para SICSAFT.
.DESCRIPTION
    Habilita los puertos de red local (LAN/WiFi) necesarios para que los teléfonos móviles
    y terminales de escaneo puedan conectarse con el servidor SICSAFT on-premise.
    Requiere ejecutarse con privilegios de Administrador.
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SICSAFT — Configuración de Firewall de Windows (LAN/WiFi)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$reglas = @(
    @{
        Name        = "SICSAFT-PWA-Móvil"
        DisplayName = "SICSAFT - PWA Móvil y Servidor HTTPS"
        Port        = "8765"
        Description = "Permite a los operadores acceder a la APP QR PWA y descargar el APK vía HTTPS en LAN."
    },
    @{
        Name        = "SICSAFT-Keycloak-OIDC"
        DisplayName = "SICSAFT - Keycloak Auth Server"
        Port        = "58080"
        Description = "Permite el flujo de autenticación OIDC y renovación de tokens JWT desde dispositivos móviles."
    },
    @{
        Name        = "SICSAFT-CIS-API"
        DisplayName = "SICSAFT - CIS API Gateway"
        Port        = "56000"
        Description = "Permite a la APP QR consultar el catálogo de activos y enviar las sesiones de inventario."
    }
)

foreach ($r in $reglas) {
    Write-Host "Configurando regla: $($r.DisplayName) (Puerto TCP $($r.Port))..." -NoNewline
    
    # Eliminar regla previa si existiera para evitar duplicados
    Get-NetFirewallRule -Name $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

    # Crear nueva regla de entrada
    New-NetFirewallRule `
        -Name $r.Name `
        -DisplayName $r.DisplayName `
        -Description $r.Description `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $r.Port `
        -Action Allow `
        -Profile Any `
        -Enabled True | Out-Null

    Write-Host " [HABILITADO]" -ForegroundColor Green
}

Write-Host "`nVerificando IP de red local (LAN):" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and $_.IPAddress -notlike "169.254.*" }
foreach ($ip in $ips) {
    Write-Host " -> Adaptador: $($ip.InterfaceAlias) | IP: $($ip.IPAddress)" -ForegroundColor White
}

Write-Host "`nTodas las reglas de Firewall para SICSAFT han sido configuradas correctamente." -ForegroundColor Green
Write-Host "Los dispositivos móviles en la misma red WiFi/LAN ya pueden conectarse a https://<IP>:8765" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
