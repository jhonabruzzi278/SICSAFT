<#
.SYNOPSIS
    Automatiza el alta de un cliente nuevo contra un Zitadel de devops/onprem/ recien levantado y
    vacio: crea la Organizacion, el proyecto "CIS", los roles y las apps OIDC necesarias segun el
    nivel de producto contratado (INST-RF-03) — reemplaza los ~10 pasos manuales que hoy documenta
    devops/local/README.md "Cliente OIDC real" por un solo comando.

.DESCRIPTION
    Wrapper delgado sobre lib/Bootstrap-Zitadel.psm1 (Invoke-BootstrapCliente) — la misma logica
    que usa instalar-cliente.ps1 en el flujo automatizado completo. Sirve para re-bootstrapear un
    cliente a mano, o para instalaciones donde no se quiere/puede usar el orquestador end-to-end
    (ver devops/onprem/README.md "Instalación manual (paso a paso)").

    NOTA DE HONESTIDAD: ver el encabezado de lib/Bootstrap-Zitadel.psm1 — los shapes de la
    Management API usados aca no estan verificados todavia contra una instancia real.

    Requiere un Personal Access Token (PAT). Con instalar-cliente.ps1 este PAT se obtiene solo
    (ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*/PATPATH, ver docker-compose.yml) — si se corre este
    script suelto en cambio, hace falta pasar uno ya generado (por ejemplo, leyendo
    devops/onprem/.bootstrap/admin-pat.txt despues de un `podman-compose up zitadel`, o el de un
    service user creado a mano en la Console — ver devops/local/README.md "Rol
    administrador-sistema + integracion Zitadel Admin API" para ese ultimo caso).

.PARAMETER DominioBase
    Dominio local de este cliente (ej. "duoc-melipilla.test") — determina el dominio de cada app
    OIDC (qr.<dominio>, ccp.<dominio>, etc). Default: sicsaft.localhost.

.PARAMETER Issuer
    URL base de este Zitadel onprem. Default: http://id.<DominioBase>.

.PARAMETER Pat
    Personal Access Token del service user IAM/Org Manager (ver DESCRIPTION).

.PARAMETER ClienteNombre
    Nombre de la Organizacion a crear para este cliente (ej. "Municipalidad de Melipilla").

.PARAMETER OrganizacionId
    Id de texto corto que CORE usara para este cliente — se escribe en ZITADEL_ORG_ID_MAP.

.PARAMETER Nivel
    1 o 2 — determina que roles/apps OIDC se crean (ver
    aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md).

.EXAMPLE
    ./bootstrap-zitadel.ps1 -Pat "pat_xxx" -ClienteNombre "Municipalidad de Melipilla" `
        -OrganizacionId "municipalidad-melipilla" -Nivel 2
#>
param(
    [string]$DominioBase = "sicsaft.localhost",
    [string]$Issuer,
    [Parameter(Mandatory = $true)][string]$Pat,
    [Parameter(Mandatory = $true)][string]$ClienteNombre,
    [Parameter(Mandatory = $true)][string]$OrganizacionId,
    [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel
)

$ErrorActionPreference = "Stop"
if (-not $Issuer) { $Issuer = "http://id.$DominioBase" }

Import-Module (Join-Path $PSScriptRoot "lib/Bootstrap-Zitadel.psm1") -Force

$resultado = Invoke-BootstrapCliente -DominioBase $DominioBase -Issuer $Issuer -Pat $Pat -ClienteNombre $ClienteNombre `
    -OrganizacionId $OrganizacionId -Nivel $Nivel

Write-Host ""
Write-Host "== Listo. Pegar estos valores en devops/onprem/.env =="
foreach ($clave in $resultado.Keys) {
    if ($null -ne $resultado[$clave]) {
        Write-Host "$clave=$($resultado[$clave])"
    }
}
Write-Host ""
Write-Host "Guardar ZITADEL_ADMIN_TOKEN tambien en el gestor de secretos del admin (por cliente) -"
Write-Host "ver aidlc-docs/devops/requirements/REQUIREMENTS.md INST-Q-02."
