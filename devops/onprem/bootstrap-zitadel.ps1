<#
.SYNOPSIS
    Automatiza el alta de un cliente nuevo contra un Zitadel de devops/onprem/ recien levantado y
    vacio: crea la Organizacion, el proyecto "CIS", los roles y las apps OIDC necesarias segun el
    nivel de producto contratado (INST-RF-03) — reemplaza los ~10 pasos manuales que hoy documenta
    devops/local/README.md "Cliente OIDC real" por un solo comando.

.DESCRIPTION
    NOTA DE HONESTIDAD (mismo criterio que cis/src/zitadel-admin/zitadel-admin.types.ts): los
    shapes de la Management API que usa este script estan armados contra la documentacion publica
    de Zitadel y el mismo patron que ya usa `cis/src/zitadel-admin/zitadel-admin.service.ts`
    (headers, endpoints de orgs/proyectos/roles), pero la creacion de apps OIDC/roles vista acá NO
    esta verificada todavia contra una instancia real — verificar contra el Zitadel de
    devops/onprem/ (ver Verificacion en el plan de este incremento) antes de usarlo en la
    instalacion de un cliente pagante, y ajustar los shapes si la forma real difiere.

    Requiere un Personal Access Token (PAT) de un service user con rol IAM/Org Manager, creado UNA
    VEZ por instancia de Zitadel via la Console (mismo paso manual que ya documenta
    devops/local/README.md "Rol administrador-sistema + integracion Zitadel Admin API" — este
    script no automatiza ESE paso puntual, automatiza todo lo que viene despues).

.PARAMETER Issuer
    URL base de este Zitadel onprem. Default: http://id.sicsaft.localhost (dominio local del
    stack, ver devops/onprem/traefik/dynamic.yml).

.PARAMETER Pat
    Personal Access Token del service user IAM/Org Manager (ver DESCRIPTION).

.PARAMETER ClienteNombre
    Nombre de la Organizacion a crear para este cliente (ej. "Municipalidad de Melipilla").

.PARAMETER OrganizacionId
    Id de texto corto que CORE usara para este cliente (ej. "municipalidad-melipilla") — se
    escribe en ZITADEL_ORG_ID_MAP.

.PARAMETER Nivel
    1 o 2 — determina que roles/apps OIDC se crean (ver
    aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

.EXAMPLE
    ./bootstrap-zitadel.ps1 -Pat "pat_xxx" -ClienteNombre "Municipalidad de Melipilla" `
        -OrganizacionId "municipalidad-melipilla" -Nivel 2
#>
param(
    [string]$Issuer = "http://id.sicsaft.localhost",
    [Parameter(Mandatory = $true)][string]$Pat,
    [Parameter(Mandatory = $true)][string]$ClienteNombre,
    [Parameter(Mandatory = $true)][string]$OrganizacionId,
    [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel
)

$ErrorActionPreference = "Stop"

function Invoke-ZitadelApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$OrgId = $null
    )
    $headers = @{ Authorization = "Bearer $Pat" }
    if ($OrgId) { $headers["x-zitadel-orgid"] = $OrgId }
    $uri = "$Issuer$Path"
    $jsonBody = if ($Body) { $Body | ConvertTo-Json -Depth 10 } else { "{}" }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers `
        -ContentType "application/json" -Body $jsonBody
}

function New-OidcApp {
    param([string]$ProjectId, [string]$OrgId, [string]$Nombre, [string]$Dominio)
    $redirectUri = "http://$Dominio/auth/callback"
    $body = @{
        name                  = $Nombre
        redirectUris          = @($redirectUri)
        responseTypes         = @("OIDC_RESPONSE_TYPE_CODE")
        grantTypes            = @("OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN")
        appType               = "OIDC_APP_TYPE_USER_AGENT"
        authMethodType        = "OIDC_AUTH_METHOD_TYPE_NONE"
        postLogoutRedirectUris = @("http://$Dominio/")
        devMode               = $true
        accessTokenType       = "OIDC_TOKEN_TYPE_JWT"
        accessTokenRoleAssertion = $true
        idTokenRoleAssertion  = $true
    }
    $resp = Invoke-ZitadelApi -Method Post -Path "/management/v1/projects/$ProjectId/apps/oidc" `
        -Body $body -OrgId $OrgId
    Write-Host "  $Nombre -> clientId: $($resp.clientId)"
    return $resp.clientId
}

Write-Host "== 1. Creando organizacion '$ClienteNombre' =="
$org = Invoke-ZitadelApi -Method Post -Path "/management/v1/orgs" -Body @{ name = $ClienteNombre }
$orgId = $org.id
Write-Host "   orgId: $orgId"

Write-Host "== 2. Creando proyecto 'CIS' =="
$project = Invoke-ZitadelApi -Method Post -Path "/management/v1/projects" `
    -Body @{ name = "CIS"; projectRoleAssertion = $true } -OrgId $orgId
$projectId = $project.id
Write-Host "   projectId: $projectId"

Write-Host "== 3. Creando roles de Proyecto =="
$roles = @("administrador-patrimonial")
if ($Nivel -eq 2) { $roles += @("directivo", "administrador-sistema") }
foreach ($rol in $roles) {
    Invoke-ZitadelApi -Method Post -Path "/management/v1/projects/$projectId/roles" `
        -Body @{ roleKey = $rol; displayName = $rol } -OrgId $orgId | Out-Null
    Write-Host "   rol creado: $rol"
}

Write-Host "== 4. Creando apps OIDC =="
$appQrClientId = New-OidcApp -ProjectId $projectId -OrgId $orgId `
    -Nombre "app-qr-sicsaft" -Dominio "qr.sicsaft.localhost"

$ccpClientId = $null
$webAdminClientId = $null
$coreFrontendClientId = $null
if ($Nivel -eq 2) {
    $ccpClientId = New-OidcApp -ProjectId $projectId -OrgId $orgId `
        -Nombre "ccp-sicsaft" -Dominio "ccp.sicsaft.localhost"
    $webAdminClientId = New-OidcApp -ProjectId $projectId -OrgId $orgId `
        -Nombre "web-admin-sicsaft" -Dominio "admin.sicsaft.localhost"
    $coreFrontendClientId = New-OidcApp -ProjectId $projectId -OrgId $orgId `
        -Nombre "core-frontend-sicsaft" -Dominio "directivo.sicsaft.localhost"
}

Write-Host ""
Write-Host "== Listo. Pegar estos valores en devops/onprem/.env =="
Write-Host "CIS_ZITADEL_AUDIENCE=$projectId"
$orgMap = @{ $orgId = $OrganizacionId } | ConvertTo-Json -Compress
Write-Host "ZITADEL_ORG_ID_MAP=$orgMap"
Write-Host "ZITADEL_ADMIN_TOKEN=$Pat"
Write-Host "ZITADEL_PROJECT_ID=$projectId"
Write-Host "APP_QR_VITE_ZITADEL_CLIENT_ID=$appQrClientId"
if ($Nivel -eq 2) {
    Write-Host "CCP_VITE_ZITADEL_CLIENT_ID=$ccpClientId"
    Write-Host "WEB_ADMIN_VITE_ZITADEL_CLIENT_ID=$webAdminClientId"
    Write-Host "CORE_FRONTEND_VITE_ZITADEL_CLIENT_ID=$coreFrontendClientId"
}
Write-Host ""
Write-Host "Guardar ZITADEL_ADMIN_TOKEN tambien en el gestor de secretos del admin (por cliente) —"
Write-Host "ver aidlc-docs/devops/requirements/REQUIREMENTS.md INST-Q-02."
