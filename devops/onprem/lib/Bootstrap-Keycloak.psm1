<#
    Logica reusable de alta de cliente contra la Admin REST API de Keycloak — reemplaza a
    Bootstrap-Zitadel.psm1 (ADR-004 Fase 3). instalar-cliente.ps1 la usa igual que antes.

    NOTA DE HONESTIDAD: a diferencia de bootstrap-zitadel.ps1 (nunca corrido contra una instancia
    real), CADA llamada de este modulo fue verificada real contra un Keycloak 26.0 de prueba
    (Podman, 2026-08-26) antes de escribirse aca — incluyendo el login completo de un usuario de
    prueba y la inspeccion del JWT resultante (aud/organization/realm_access.roles con la forma
    exacta que espera cis/src/common/auth/keycloak-auth.guard.ts). Lo unico NO verificado en esa
    corrida es el flujo end-to-end completo contra este docker-compose.yml (Traefik + KC_HOSTNAME
    con dominio real, en vez de localhost directo) — ver devops/onprem/installer/README.md para el
    checklist de verificacion pendiente antes de usar esto con un cliente pagante.

    Diseño de roles por organizacion: los realm roles de Keycloak son GLOBALES por usuario
    (`realm_access.roles` del JWT no distingue por organizacion) — no existe una forma nativa de
    Keycloak de anidar "este rol aplica solo en esta organizacion". Se resuelve con un grupo por
    combinacion organizacion+rol (`{organizacionId}::{rol}`, mismo separador que
    GRUPO_ORGANIZACION_ROL_SEPARADOR en cis/src/common/auth/keycloak-auth.constants.ts) con el
    realm role asignado al grupo — igual que ya hace KeycloakAdminService.crearGrant().
#>

function Get-KeycloakAdminToken {
    # Login humano contra el realm "master" (admin-cli, grant_type=password) — a diferencia del PAT
    # auto-provisionado de Zitadel, Keycloak no genera nada solo: este bootstrap se autentica
    # directamente con KEYCLOAK_ADMIN_USERNAME/PASSWORD (mismas credenciales que arrancan el
    # contenedor, ver docker-compose.yml). El token expira en minutos -- Invoke-BootstrapCliente lo
    # pide una sola vez y lo pasa a cada llamada de este modulo, no lo cachea entre llamadas.
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$AdminUsername,
        [Parameter(Mandatory = $true)][string]$AdminPassword
    )
    $body = @{
        grant_type = "password"
        client_id  = "admin-cli"
        username   = $AdminUsername
        password   = $AdminPassword
    }
    # "-ErrorAction Stop" explicito -- este modulo importado tiene su propio SessionState y no
    # hereda $ErrorActionPreference = "Stop" del script que lo llama (ver Invoke-KeycloakAdminApi
    # mas abajo para el detalle del hallazgo real).
    $resp = Invoke-RestMethod -Method Post `
        -Uri "$KeycloakUrl/realms/master/protocol/openid-connect/token" `
        -ContentType "application/x-www-form-urlencoded" -Body $body -ErrorAction Stop
    return $resp.access_token
}

function Invoke-KeycloakAdminApi {
    # Wrapper delgado sobre la Admin REST API de un realm (`/admin/realms/{realm}/...`). A
    # diferencia de Invoke-ZitadelApi (que devolvia solo el body), este devuelve la respuesta
    # completa de Invoke-WebRequest -- varios endpoints de Keycloak (POST /users, /groups,
    # /organizations) NO devuelven el recurso creado en el body, solo un header Location con el id
    # (verificado real) -- el caller decide si lee .Content o .Headers.Location segun el endpoint.
    # Sin "-SkipHttpErrorCheck" (parametro de PowerShell 7+, no existe en Windows PowerShell 5.1,
    # el runtime real de instalar-cliente.ps1) -- se deja que Invoke-WebRequest tire una excepcion
    # terminante en cualquier respuesta de error, igual que Invoke-ZitadelApi ya hacia con
    # Invoke-RestMethod.
    #
    # "-UseBasicParsing" es obligatorio, no cosmetico -- bug real encontrado corriendo este modulo
    # de verdad (2026-08-26): sin el, Invoke-WebRequest intenta armar un DOM "ParsedHtml" via el
    # motor de Internet Explorer, que tira "Windows PowerShell se encuentra en modo no
    # interactivo" apenas se invoca desde un host sin IE inicializado (exactamente el caso de
    # instalar-cliente.ps1, corrido via powershell.exe no interactivo) -- con el flag, el cmdlet
    # nunca intenta parsear HTML y solo devuelve .Content/.Headers como texto/bytes crudos.
    #
    # "-ErrorAction Stop" explicito es TAMBIEN obligatorio, no redundante con
    # $ErrorActionPreference = "Stop" de instalar-cliente.ps1/bootstrap-keycloak.ps1 -- bug real
    # encontrado en la misma corrida: un modulo importado (.psm1) tiene su PROPIO SessionState,
    # que no hereda el valor de $ErrorActionPreference del script que lo importa. Sin este flag,
    # cada llamada fallida acá adentro quedaba como error NO terminante (`Continue`, el default
    # del módulo) y el resto del bootstrap seguía corriendo sobre datos que nunca se crearon,
    # imprimiendo "creado" para cosas que en realidad fallaron.
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$Realm,
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body = $null
    )
    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "$KeycloakUrl/admin/realms/$Realm$Path"
    $params = @{
        Method          = $Method
        Uri             = $uri
        Headers         = $headers
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }
    if ($null -ne $Body) {
        $params["ContentType"] = "application/json"
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    return Invoke-WebRequest @params
}

function Get-LocationId {
    # El header Location de un 201 viene como ".../admin/realms/sicsaft/users/{id}" -- el id
    # siempre es el ultimo segmento.
    param([Parameter(Mandatory = $true)]$Response)
    $location = $Response.Headers["Location"]
    if ($location -is [array]) { $location = $location[0] }
    return ($location -split "/")[-1]
}

function New-KeycloakRealmScaffold {
    # Paso 1-4 del bootstrap: realm "sicsaft" con Organizations habilitado, el client scope
    # "organization" promovido a default (por defecto Keycloak lo deja OPCIONAL -- verificado
    # real: sin este paso, el claim `organization` nunca aparece en el token porque los 4
    # frontends piden un scope fijo, "openid profile offline_access", que nunca lo incluye), un
    # client scope propio "cis-audience" con un Audience mapper fijo (reemplaza a
    # CIS_ZITADEL_AUDIENCE, que Zitadel generaba dinamicamente por Proyecto -- acá es una
    # constante, "cis", igual en KEYCLOAK_AUDIENCE de cis/), y los 3 realm roles de negocio.
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$Token
    )
    Write-Host "  Creando realm 'sicsaft' (organizationsEnabled)..."
    Invoke-RestMethod -Method Post -Uri "$KeycloakUrl/admin/realms" `
        -Headers @{ Authorization = "Bearer $Token" } -ContentType "application/json" `
        -Body (@{ realm = "sicsaft"; enabled = $true; organizationsEnabled = $true } | ConvertTo-Json) `
        -ErrorAction Stop | Out-Null

    $scopesResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/client-scopes"
    $scopes = $scopesResp.Content | ConvertFrom-Json
    $orgScopeId = ($scopes | Where-Object { $_.name -eq "organization" }).id

    Write-Host "  Promoviendo el scope 'organization' de opcional a default..."
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Delete -Path "/default-optional-client-scopes/$orgScopeId" | Out-Null
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Put -Path "/default-default-client-scopes/$orgScopeId" | Out-Null

    Write-Host "  Creando client scope 'cis-audience'..."
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/client-scopes" -Body @{
        name       = "cis-audience"
        protocol   = "openid-connect"
        attributes = @{ "include.in.token.scope" = "false"; "display.on.consent.screen" = "false" }
    } | Out-Null
    $scopesResp2 = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/client-scopes"
    $audScopeId = (($scopesResp2.Content | ConvertFrom-Json) | Where-Object { $_.name -eq "cis-audience" }).id
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/client-scopes/$audScopeId/protocol-mappers/models" -Body @{
        name            = "cis-audience-mapper"
        protocol        = "openid-connect"
        protocolMapper  = "oidc-audience-mapper"
        config          = @{
            "included.custom.audience" = "cis"
            "id.token.claim"           = "false"
            "access.token.claim"       = "true"
        }
    } | Out-Null
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Put -Path "/default-default-client-scopes/$audScopeId" | Out-Null

    # Mismos 3 roles que ya usaba el proyecto "CIS" de Zitadel. "profesional-aft" es el rol de
    # realm; el que rutea al Profesional de AFT al portal `ccp` es "administrador-patrimonial"
    # (grupo por Organization). El CCP va completo en todos los niveles (DOC-025 §1.1).
    Write-Host "  Creando realm roles..."
    foreach ($rol in @("profesional-aft", "directivo", "administrador-sistema")) {
        Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
            -Method Post -Path "/roles" -Body @{ name = $rol } | Out-Null
        Write-Host "    rol creado: $rol"
    }
}

function New-KeycloakOrganizacion {
    # A diferencia de Zitadel (que devolvia un id numerico propio como orgId), Keycloak ignora
    # cualquier id provisto y genera su propio UUID interno -- lo unico que honra es `alias`
    # (verificado real, mismo hallazgo ya documentado en
    # cis/src/keycloak-admin/keycloak-admin.service.ts). El `alias` que se pasa acá ES el
    # organizacionId que va a usar el resto del ecosistema (CORE, el claim `organization` del
    # JWT) -- no hay mapeo externo que completar despues (a diferencia de ZITADEL_ORG_ID_MAP).
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$ClienteNombre,
        [Parameter(Mandatory = $true)][string]$OrganizacionId
    )
    Write-Host "  Creando Organization '$ClienteNombre' (alias: $OrganizacionId)..."
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/organizations" -Body @{
        name    = $ClienteNombre
        alias   = $OrganizacionId
        domains = @(@{ name = "$OrganizacionId.sicsaft.invalid"; verified = $false })
    } | Out-Null
}

function New-KeycloakPublicClient {
    # Client OIDC publico con PKCE obligatorio -- equivalente al OIDC_APP_TYPE_USER_AGENT +
    # OIDC_AUTH_METHOD_TYPE_NONE de Zitadel. Hereda "organization" y "cis-audience" como scopes
    # DEFAULT automaticamente (verificado real: cualquier client creado despues de
    # New-KeycloakRealmScaffold ya los trae en /default-client-scopes sin wiring extra), asi que
    # ningun cambio en el frontend (oidc-client.ts sigue pidiendo solo "openid profile
    # offline_access") hace falta para que igual lleguen esos claims.
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$ClientId,
        [Parameter(Mandatory = $true)][string]$Dominio
    )
    $redirectUri = "http://$Dominio/auth/callback"
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/clients" -Body @{
        clientId                  = $ClientId
        name                      = $ClientId
        protocol                  = "openid-connect"
        publicClient              = $true
        standardFlowEnabled       = $true
        implicitFlowEnabled       = $false
        directAccessGrantsEnabled = $false
        serviceAccountsEnabled    = $false
        redirectUris              = @($redirectUri)
        webOrigins                = @("http://$Dominio")
        attributes                = @{
            "pkce.code.challenge.method" = "S256"
            "post.logout.redirect.uris"  = "http://$Dominio/"
        }
    } | Out-Null
    Write-Host "  $ClientId -> clientId: $ClientId (redirectUri: $redirectUri)"
    return $ClientId
}

function New-KeycloakAdminServiceAccount {
    # Client confidencial con service account -- reemplaza al PAT estatico de Zitadel
    # (ZITADEL_ADMIN_TOKEN). CIS lo usa via client_credentials para la Admin REST API
    # (KeycloakAdminService, ver cis/src/keycloak-admin/). Set de roles de realm-management
    # verificado real como suficiente para TODO lo que KeycloakAdminService llama (organizations,
    # users, groups, role-mappings) sin llegar a otorgar el composite "realm-admin" completo
    # (mas amplio de lo necesario, aunque en un Keycloak de un solo cliente por instancia
    # tampoco seria un riesgo grave).
    param(
        [Parameter(Mandatory = $true)][string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$Token
    )
    Write-Host "  Creando client confidencial 'cis-admin' (service account)..."
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/clients" -Body @{
        clientId                  = "cis-admin"
        name                      = "cis-admin"
        protocol                  = "openid-connect"
        publicClient               = $false
        standardFlowEnabled        = $false
        serviceAccountsEnabled     = $true
        directAccessGrantsEnabled = $false
    } | Out-Null

    $clientsResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/clients?clientId=cis-admin"
    $clientUuid = (($clientsResp.Content | ConvertFrom-Json)[0]).id

    $secretResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/clients/$clientUuid/client-secret"
    $secret = ($secretResp.Content | ConvertFrom-Json).value

    $saUserResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/clients/$clientUuid/service-account-user"
    $saUserId = ($saUserResp.Content | ConvertFrom-Json).id

    $rmClientsResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
        -Method Get -Path "/clients?clientId=realm-management"
    $rmClientUuid = (($rmClientsResp.Content | ConvertFrom-Json)[0]).id

    $roleNames = @("manage-users", "manage-realm", "query-groups", "query-users", "view-users")
    $rolesPayload = @()
    foreach ($roleName in $roleNames) {
        $roleResp = Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token `
            -Method Get -Path "/clients/$rmClientUuid/roles/$roleName"
        $rolesPayload += ($roleResp.Content | ConvertFrom-Json)
    }
    Invoke-KeycloakAdminApi -KeycloakUrl $KeycloakUrl -Realm "sicsaft" -Token $Token -Method Post `
        -Path "/users/$saUserId/role-mappings/clients/$rmClientUuid" -Body $rolesPayload | Out-Null

    return @{ ClientId = "cis-admin"; Secret = $secret }
}

<#
.SYNOPSIS
    Da de alta un cliente nuevo contra un Keycloak de devops/onprem/ recien levantado y vacio:
    realm, Organization, roles, scopes de auditoria/organizacion y apps OIDC segun el nivel de
    producto (INST-RF-03/07). Reemplaza a Invoke-BootstrapCliente de Bootstrap-Zitadel.psm1.

.OUTPUTS
    Hashtable con todos los valores a escribir en .env (KEYCLOAK_ADMIN_CLIENT_ID,
    KEYCLOAK_ADMIN_CLIENT_SECRET, y los *_VITE_KEYCLOAK_CLIENT_ID).
#>
function Invoke-BootstrapCliente {
    param(
        [Parameter(Mandatory = $true)][string]$DominioBase,
        [string]$KeycloakUrl,
        [Parameter(Mandatory = $true)][string]$AdminUsername,
        [Parameter(Mandatory = $true)][string]$AdminPassword,
        [Parameter(Mandatory = $true)][string]$ClienteNombre,
        [Parameter(Mandatory = $true)][string]$OrganizacionId,
        [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel
    )
    if (-not $KeycloakUrl) { $KeycloakUrl = "http://id.$DominioBase" }

    Write-Host "== 1. Autenticando como admin del realm 'master' =="
    $token = Get-KeycloakAdminToken -KeycloakUrl $KeycloakUrl -AdminUsername $AdminUsername `
        -AdminPassword $AdminPassword

    Write-Host "== 2. Creando realm 'sicsaft', scopes y roles =="
    New-KeycloakRealmScaffold -KeycloakUrl $KeycloakUrl -Token $token

    Write-Host "== 3. Creando Organization '$ClienteNombre' =="
    New-KeycloakOrganizacion -KeycloakUrl $KeycloakUrl -Token $token -ClienteNombre $ClienteNombre `
        -OrganizacionId $OrganizacionId

    Write-Host "== 4. Creando client confidencial de administración (CIS) =="
    $adminClient = New-KeycloakAdminServiceAccount -KeycloakUrl $KeycloakUrl -Token $token

    Write-Host "== 5. Creando apps OIDC públicas (Nivel $Nivel) =="
    $appQrClientId = New-KeycloakPublicClient -KeycloakUrl $KeycloakUrl -Token $token `
        -ClientId "app-qr-sicsaft" -Dominio "qr.$DominioBase"
    $webAdminClientId = New-KeycloakPublicClient -KeycloakUrl $KeycloakUrl -Token $token `
        -ClientId "web-admin-sicsaft" -Dominio "admin.$DominioBase"
    $coreFrontendClientId = New-KeycloakPublicClient -KeycloakUrl $KeycloakUrl -Token $token `
        -ClientId "core-frontend-sicsaft" -Dominio "directivo.$DominioBase"

    # CCP en TODOS los niveles (unificado con sicsaft-core.exe, 2026-09-02): el portal del
    # Profesional de AFT es el mismo binario en Nivel 1 y Nivel 2. Lo único que Nivel 2 agrega es
    # el Dashboard/indicadores (CIP), gateado por el flag VITE_SICSAFT_NIVEL en el build de `ccp`,
    # no por un client OIDC aparte. Antes este client solo se creaba en Nivel 2 ("CCP acotado en
    # Nivel 1", revertido).
    $ccpClientId = New-KeycloakPublicClient -KeycloakUrl $KeycloakUrl -Token $token `
        -ClientId "ccp-sicsaft" -Dominio "ccp.$DominioBase"

    return @{
        KEYCLOAK_ADMIN_CLIENT_ID              = $adminClient.ClientId
        KEYCLOAK_ADMIN_CLIENT_SECRET          = $adminClient.Secret
        APP_QR_VITE_KEYCLOAK_CLIENT_ID        = $appQrClientId
        CCP_VITE_KEYCLOAK_CLIENT_ID           = $ccpClientId
        WEB_ADMIN_VITE_KEYCLOAK_CLIENT_ID     = $webAdminClientId
        CORE_FRONTEND_VITE_KEYCLOAK_CLIENT_ID = $coreFrontendClientId
    }
}

Export-ModuleMember -Function Invoke-BootstrapCliente
