<#
.SYNOPSIS
    Automatiza el alta de un cliente nuevo contra un Keycloak de devops/onprem/ recien levantado y
    vacio: crea el realm "sicsaft", la Organization, los roles y las apps OIDC necesarias segun el
    nivel de producto contratado (INST-RF-03) — reemplaza a bootstrap-zitadel.ps1 (ADR-004 Fase 3).

.DESCRIPTION
    Wrapper delgado sobre lib/Bootstrap-Keycloak.psm1 (Invoke-BootstrapCliente) — la misma logica
    que usa instalar-cliente.ps1 en el flujo automatizado completo. Sirve para re-bootstrapear un
    cliente a mano, o para instalaciones donde no se quiere/puede usar el orquestador end-to-end
    (ver devops/onprem/README.md "Instalación manual (paso a paso)").

    NOTA DE HONESTIDAD: ver el encabezado de lib/Bootstrap-Keycloak.psm1 — cada llamada de este
    modulo fue verificada real contra un Keycloak 26.0 de prueba (2026-08-26), incluyendo el login
    completo de un usuario y la inspeccion del JWT resultante. Lo que NO se corrio en esa
    verificacion es el flujo end-to-end completo contra este docker-compose.yml (Traefik +
    KC_HOSTNAME con dominio real) — ver devops/onprem/installer/README.md para el checklist
    pendiente antes de usar esto con un cliente pagante.

    A diferencia de Zitadel (PAT auto-provisionado al primer arranque), este script se autentica
    con las credenciales de KEYCLOAK_ADMIN_USERNAME/PASSWORD que ya arrancaron el contenedor (ver
    docker-compose.yml) — no hace falta ningun archivo de bootstrap previo.

.PARAMETER DominioBase
    Dominio local de este cliente (ej. "duoc-melipilla.test") — determina el dominio de cada app
    OIDC (qr.<dominio>, ccp.<dominio>, etc). Default: sicsaft.localhost.

.PARAMETER KeycloakUrl
    URL base de este Keycloak onprem. Default: http://id.<DominioBase>.

.PARAMETER AdminUsername
    Usuario admin del realm "master" (KEYCLOAK_ADMIN_USERNAME en .env).

.PARAMETER AdminPassword
    Password de ese usuario (KEYCLOAK_ADMIN_PASSWORD en .env).

.PARAMETER ClienteNombre
    Nombre de la Organization a crear para este cliente (ej. "Municipalidad de Melipilla").

.PARAMETER OrganizacionId
    Alias de texto corto que CORE usara para este cliente — a diferencia de
    ZITADEL_ORG_ID_MAP (un mapeo externo que había que completar después), acá ES directamente el
    `alias` de la Organization en Keycloak, no hay mapeo que armar aparte.

.PARAMETER Nivel
    1 o 2 — determina que apps OIDC se crean (ver
    aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

.EXAMPLE
    ./bootstrap-keycloak.ps1 -AdminUsername admin -AdminPassword "unaClaveCualquiera" `
        -ClienteNombre "Municipalidad de Melipilla" -OrganizacionId "municipalidad-melipilla" -Nivel 2
#>
param(
    [string]$DominioBase = "sicsaft.localhost",
    [string]$KeycloakUrl,
    [Parameter(Mandatory = $true)][string]$AdminUsername,
    [Parameter(Mandatory = $true)][string]$AdminPassword,
    [Parameter(Mandatory = $true)][string]$ClienteNombre,
    [Parameter(Mandatory = $true)][string]$OrganizacionId,
    [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel
)

$ErrorActionPreference = "Stop"
if (-not $KeycloakUrl) { $KeycloakUrl = "http://id.$DominioBase" }

Import-Module (Join-Path $PSScriptRoot "lib/Bootstrap-Keycloak.psm1") -Force

$resultado = Invoke-BootstrapCliente -DominioBase $DominioBase -KeycloakUrl $KeycloakUrl `
    -AdminUsername $AdminUsername -AdminPassword $AdminPassword -ClienteNombre $ClienteNombre `
    -OrganizacionId $OrganizacionId -Nivel $Nivel

Write-Host ""
Write-Host "== Listo. Pegar estos valores en devops/onprem/.env =="
foreach ($clave in $resultado.Keys) {
    if ($null -ne $resultado[$clave]) {
        Write-Host "$clave=$($resultado[$clave])"
    }
}
Write-Host ""
Write-Host "Guardar KEYCLOAK_ADMIN_CLIENT_SECRET tambien en el gestor de secretos del admin (por"
Write-Host "cliente) - ver aidlc-docs/devops/requirements/REQUIREMENTS.md INST-Q-02."
