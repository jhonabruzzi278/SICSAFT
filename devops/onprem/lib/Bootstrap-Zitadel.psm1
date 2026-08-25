<#
    Logica reusable de alta de cliente contra la Management API de Zitadel — extraida de
    bootstrap-zitadel.ps1 (que ahora es un wrapper delgado sobre este modulo) para que
    instalar-cliente.ps1 la use tambien, sin duplicar codigo.

    NOTA DE HONESTIDAD (mismo criterio que cis/src/zitadel-admin/zitadel-admin.types.ts): los
    shapes de la Management API usados aca (orgs/projects/roles/apps oidc) estan armados contra
    la documentacion publica de Zitadel y el mismo patron que ya usa
    cis/src/zitadel-admin/zitadel-admin.service.ts (headers, endpoints), pero NO estan
    verificados todavia contra una instancia real — ver devops/onprem/installer/README.md para
    el checklist de verificacion pendiente antes de usar esto con un cliente pagante.
#>

function Invoke-ZitadelApi {
    param(
        [Parameter(Mandatory = $true)][string]$Issuer,
        [Parameter(Mandatory = $true)][string]$Pat,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
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

function New-ZitadelOidcApp {
    param(
        [Parameter(Mandatory = $true)][string]$Issuer,
        [Parameter(Mandatory = $true)][string]$Pat,
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$OrgId,
        [Parameter(Mandatory = $true)][string]$Nombre,
        [Parameter(Mandatory = $true)][string]$Dominio
    )
    $redirectUri = "http://$Dominio/auth/callback"
    $body = @{
        name                     = $Nombre
        redirectUris             = @($redirectUri)
        responseTypes            = @("OIDC_RESPONSE_TYPE_CODE")
        grantTypes               = @("OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN")
        appType                  = "OIDC_APP_TYPE_USER_AGENT"
        authMethodType           = "OIDC_AUTH_METHOD_TYPE_NONE"
        postLogoutRedirectUris   = @("http://$Dominio/")
        devMode                  = $true
        accessTokenType          = "OIDC_TOKEN_TYPE_JWT"
        accessTokenRoleAssertion = $true
        idTokenRoleAssertion     = $true
    }
    $resp = Invoke-ZitadelApi -Issuer $Issuer -Pat $Pat -Method Post `
        -Path "/management/v1/projects/$ProjectId/apps/oidc" -Body $body -OrgId $OrgId
    Write-Host "  $Nombre -> clientId: $($resp.clientId)"
    return $resp.clientId
}

<#
.SYNOPSIS
    Da de alta un cliente nuevo contra un Zitadel de devops/onprem/ recien levantado y vacio:
    organizacion, proyecto "CIS", roles y apps OIDC segun el nivel de producto (INST-RF-03/07).

.OUTPUTS
    Hashtable con todos los valores a escribir en .env (CIS_ZITADEL_AUDIENCE,
    ZITADEL_ORG_ID_MAP, ZITADEL_ADMIN_TOKEN, ZITADEL_PROJECT_ID, y los *_CLIENT_ID).
#>
function Invoke-BootstrapCliente {
    param(
        # Dominio local de este cliente (ej. "duoc-melipilla.test") — instalar-cliente.ps1 siempre
        # lo pasa explicito; el default "sicsaft.localhost" solo cubre a quien invoque este modulo
        # suelto sin pasar el parametro (compatibilidad hacia atras).
        [string]$DominioBase = "sicsaft.localhost",
        [string]$Issuer,
        [Parameter(Mandatory = $true)][string]$Pat,
        [Parameter(Mandatory = $true)][string]$ClienteNombre,
        [Parameter(Mandatory = $true)][string]$OrganizacionId,
        [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel
    )
    if (-not $Issuer) { $Issuer = "http://id.$DominioBase" }

    Write-Host "== 1. Creando organizacion '$ClienteNombre' =="
    $org = Invoke-ZitadelApi -Issuer $Issuer -Pat $Pat -Method Post -Path "/management/v1/orgs" `
        -Body @{ name = $ClienteNombre }
    $orgId = $org.id
    Write-Host "   orgId: $orgId"

    Write-Host "== 2. Creando proyecto 'CIS' =="
    $project = Invoke-ZitadelApi -Issuer $Issuer -Pat $Pat -Method Post -Path "/management/v1/projects" `
        -Body @{ name = "CIS"; projectRoleAssertion = $true } -OrgId $orgId
    $projectId = $project.id
    Write-Host "   projectId: $projectId"

    # Niveles (DOC-025 §1, revisado 2026-08-25): Nivel 1 ya incluye Directivo y Administrador del
    # Sistema (antes solo entraban en Nivel 2) — el rol "profesional-aft" cubre tanto la APP QR
    # como, a futuro, el portal liviano "web-aft" (🔲 sin código todavía, ver DOC-025 §1). CCP
    # (portal COMPLETO de AFT) sigue gated a Nivel 2, igual que antes.
    Write-Host "== 3. Creando roles de Proyecto =="
    $roles = @("profesional-aft", "directivo", "administrador-sistema")
    foreach ($rol in $roles) {
        Invoke-ZitadelApi -Issuer $Issuer -Pat $Pat -Method Post `
            -Path "/management/v1/projects/$projectId/roles" `
            -Body @{ roleKey = $rol; displayName = $rol } -OrgId $orgId | Out-Null
        Write-Host "   rol creado: $rol"
    }

    Write-Host "== 4. Creando apps OIDC =="
    $appQrClientId = New-ZitadelOidcApp -Issuer $Issuer -Pat $Pat -ProjectId $projectId -OrgId $orgId `
        -Nombre "app-qr-sicsaft" -Dominio "qr.$DominioBase"
    $webAdminClientId = New-ZitadelOidcApp -Issuer $Issuer -Pat $Pat -ProjectId $projectId -OrgId $orgId `
        -Nombre "web-admin-sicsaft" -Dominio "admin.$DominioBase"
    $coreFrontendClientId = New-ZitadelOidcApp -Issuer $Issuer -Pat $Pat -ProjectId $projectId -OrgId $orgId `
        -Nombre "core-frontend-sicsaft" -Dominio "directivo.$DominioBase"

    $ccpClientId = $null
    if ($Nivel -eq 2) {
        $ccpClientId = New-ZitadelOidcApp -Issuer $Issuer -Pat $Pat -ProjectId $projectId -OrgId $orgId `
            -Nombre "ccp-sicsaft" -Dominio "ccp.$DominioBase"
    }

    $orgMap = @{ $orgId = $OrganizacionId } | ConvertTo-Json -Compress

    return @{
        CIS_ZITADEL_AUDIENCE                 = $projectId
        ZITADEL_ORG_ID_MAP                   = $orgMap
        ZITADEL_ADMIN_TOKEN                  = $Pat
        ZITADEL_PROJECT_ID                   = $projectId
        APP_QR_VITE_ZITADEL_CLIENT_ID        = $appQrClientId
        CCP_VITE_ZITADEL_CLIENT_ID           = $ccpClientId
        WEB_ADMIN_VITE_ZITADEL_CLIENT_ID     = $webAdminClientId
        CORE_FRONTEND_VITE_ZITADEL_CLIENT_ID = $coreFrontendClientId
    }
}

Export-ModuleMember -Function Invoke-BootstrapCliente
