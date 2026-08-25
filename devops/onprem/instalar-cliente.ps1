<#
.SYNOPSIS
    Orquestador end-to-end de una instalacion onprem de SICSAFT para un cliente nuevo — cierra
    los pasos manuales que devops/onprem/README.md documentaba a mano (WSL2, Podman, .env,
    bootstrap de Zitadel, build) en un solo comando.

.DESCRIPTION
    NOTA DE HONESTIDAD: este script no fue corrido de punta a punta contra una maquina Windows
    real en esta sesion (sin Podman/WSL2 disponibles en el entorno donde se escribio) — es codigo
    listo para correr, no algo ya verificado. Ver devops/onprem/installer/README.md para el
    checklist de verificacion pendiente antes de usarlo con un cliente pagante. Si un paso falla,
    el script se detiene con un mensaje claro en vez de seguir en un estado a medias.

    Requiere PowerShell con permisos de administrador para los pasos de winget/wsl.

.PARAMETER ClienteNombre
    Nombre de la Organizacion a crear para este cliente (ej. "Municipalidad de Melipilla").

.PARAMETER OrganizacionId
    Id de texto corto que CORE usara para este cliente (ej. "municipalidad-melipilla").

.PARAMETER Nivel
    1 o 2 — ver aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md.

.PARAMETER InstallDir
    Carpeta de devops/onprem/ a usar (default: donde vive este script).

.EXAMPLE
    ./instalar-cliente.ps1 -ClienteNombre "Municipalidad de Melipilla" `
        -OrganizacionId "municipalidad-melipilla" -Nivel 2
#>
param(
    [Parameter(Mandatory = $true)][string]$ClienteNombre,
    [Parameter(Mandatory = $true)][string]$OrganizacionId,
    [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel,
    [string]$InstallDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

# $PSScriptRoot vino vacio en una corrida real (causa exacta no confirmada, algo especifico de
# como Inno Setup invoca powershell.exe via [Run]) -- installer/sicsaft-onprem.iss ahora pasa
# -InstallDir explicito, pero este fallback cubre tambien el caso de correr el script suelto sin
# ese parametro: $MyInvocation.MyCommand.Path es mas confiable que $PSScriptRoot en general (esta
# poblado en mas contextos de invocacion).
if (-not $InstallDir) {
    if ($MyInvocation.MyCommand.Path) {
        $InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    } else {
        throw "No se pudo determinar la carpeta de instalacion (ni -InstallDir, ni `$PSScriptRoot, ni `$MyInvocation.MyCommand.Path). Correr el script pasando -InstallDir explicito con la ruta completa de devops/onprem/."
    }
}

Set-Location $InstallDir
# Verificacion explicita en vez de confiar en que Set-Location silenciosamente funciono -- bug
# real encontrado en una corrida verificada: el cwd efectivo termino siendo C:\WINDOWS\system32
# en vez de $InstallDir, lo que rompia cualquier ruta relativa mas adelante
# (Get-Content ".env.example"). De acá en mas, todo archivo se referencia con ruta absoluta
# (Join-Path $InstallDir ...) para no depender de que esto funcione -- esta verificacion queda
# solo para fallar rapido y claro si $InstallDir ni siquiera es un directorio valido.
if ((Get-Location).ProviderPath -ne (Resolve-Path $InstallDir).ProviderPath) {
    throw "No se pudo posicionar en '$InstallDir' (Get-Location quedo en '$((Get-Location).ProviderPath)'). Volver a correr el instalador, o correr este script manualmente pasando -InstallDir con la ruta completa."
}
$EnvPath = Join-Path $InstallDir ".env"
$EnvExamplePath = Join-Path $InstallDir ".env.example"
$PatPath = Join-Path $InstallDir ".bootstrap\admin-pat.txt"
$ComposeFile = Join-Path $InstallDir "docker-compose.yml"

function Write-Paso {
    param([string]$Texto)
    Write-Host ""
    Write-Host "== $Texto ==" -ForegroundColor Cyan
}

function New-ClavealAzar {
    -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
}

function New-ClaveConSimbolo {
    # Zitadel exige mayuscula+minuscula+digito+simbolo en la contraseña del admin humano (de ahi
    # el sufijo "-Aa1!" del placeholder en .env.example) — New-ClavealAzar sola no lo garantiza.
    $base = New-ClavealAzar
    return "$base-Aa1!"
}

function Set-HostsLocales {
    # Paso "1. Resolver los dominios locales" de README.md -- hasta ahora 100% manual. Sin esto,
    # el smoke check final (Test-Servicio) falla por resolucion de DNS aunque el stack este sano,
    # y el tecnico no puede entrar a los portales desde el navegador tampoco.
    Write-Paso "0. Configurando dominios locales (hosts)"
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $dominios = @("id.sicsaft.localhost", "api.sicsaft.localhost", "qr.sicsaft.localhost")
    if ($Nivel -eq 2) {
        $dominios += @("ccp.sicsaft.localhost", "admin.sicsaft.localhost", "directivo.sicsaft.localhost")
    }
    $contenidoActual = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
    $lineasNuevas = @()
    foreach ($dominio in $dominios) {
        if ($contenidoActual -notmatch [regex]::Escape($dominio)) {
            $lineasNuevas += "127.0.0.1 $dominio"
        }
    }
    if ($lineasNuevas.Count -gt 0) {
        Add-Content -Path $hostsPath -Value $lineasNuevas
        Write-Host "Agregados al hosts: $($lineasNuevas -join ', ')"
    } else {
        Write-Host "Dominios locales ya estaban en el hosts."
    }
}

function Test-Wsl2 {
    Write-Paso "1. Verificando WSL2"
    # Sin "2>&1": con $ErrorActionPreference = "Stop", cualquier linea que el comando nativo
    # escriba a stderr se convierte en un error terminante aunque el exit code sea 0 (bug real
    # encontrado en podman machine start, ver mas abajo) -- alcanza con revisar $LASTEXITCODE.
    wsl --status | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WSL2 no esta instalado. Instalando (wsl --install --no-distribution)..."
        wsl --install --no-distribution
        Write-Host ""
        Write-Host "WSL2 requiere reiniciar Windows para terminar de instalarse." -ForegroundColor Yellow
        Write-Host "Reiniciar el equipo y volver a correr este script." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "WSL2 OK."
}

function Update-PathDeSesion {
    # winget actualiza el PATH del registro (Machine/User), pero la sesion de PowerShell actual
    # no lo relee sola -- sin esto, un comando como 'podman' recien instalado sigue fallando como
    # "no reconocido" en la misma corrida del script, aunque winget haya terminado bien.
    # Bug real encontrado y corregido en la primera corrida verificada de este script.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Test-Podman {
    Write-Paso "2. Verificando Podman"
    if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
        Write-Host "Podman no encontrado. Instalando con winget..."
        winget install -e --id RedHat.Podman --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo la instalacion de Podman via winget. Instalar manualmente desde https://podman.io/ y volver a correr este script."
        }
        Update-PathDeSesion
        if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
            throw "Podman se instalo pero 'podman' sigue sin encontrarse ni despues de refrescar el PATH. Cerrar esta terminal, abrir una nueva como administrador, y volver a correr este script."
        }
        Write-Host "Podman instalado."
    }

    # Sin "2>&1" en ninguno de los dos -- mismo motivo que Test-Wsl2 (bug real encontrado: un
    # simple warning de podman en stderr, "your ... screen size is bogus", tiraba abajo el
    # script entero por $ErrorActionPreference = "Stop" aunque el comando haya funcionado bien).
    $machineList = podman machine list --format "{{.Name}}"
    if ($LASTEXITCODE -ne 0 -or -not $machineList) {
        Write-Host "Inicializando maquina Podman (podman machine init)..."
        podman machine init | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Fallo 'podman machine init'." }
    }
    # No se falla si el exit code es distinto de 0 -- "la maquina ya esta corriendo" tambien
    # devuelve no-cero segun la version de Podman, y es un caso valido (idempotente), no un error.
    podman machine start | Out-Null
    Write-Host "Podman OK."
}

function Get-PythonFuncional {
    # Get-Command sola no alcanza: en Windows es comun que 'python'/'pip' existan en el PATH como
    # un stub que no funciona de verdad (alias de Microsoft Store, o -- bug real encontrado en la
    # segunda corrida verificada -- un "trampolin" de uv que no logra encontrar un interprete
    # Python real detras). Se prueba ejecutando el interprete de verdad, no solo si el comando
    # existe.
    foreach ($candidato in @("python", "python3")) {
        if (Get-Command $candidato -ErrorAction SilentlyContinue) {
            try {
                & $candidato --version *> $null
                if ($LASTEXITCODE -eq 0) { return $candidato }
            } catch {}
        }
    }
    return $null
}

function Test-PodmanCompose {
    Write-Paso "3. Verificando podman-compose"
    if (-not (Get-Command podman-compose -ErrorAction SilentlyContinue)) {
        $python = Get-PythonFuncional
        if (-not $python) {
            Write-Host "Python no encontrado o no funcional. Instalando con winget..."
            winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
            if ($LASTEXITCODE -ne 0) {
                throw "Fallo la instalacion de Python via winget. Instalar manualmente y volver a correr este script."
            }
            Update-PathDeSesion
            $python = Get-PythonFuncional
            if (-not $python) {
                throw "Python se instalo pero sigue sin funcionar (revisar si hay un 'python'/'pip' de otra herramienta -- ej. uv -- tapando al oficial en el PATH). Cerrar esta terminal, abrir una nueva como administrador, y volver a correr este script; si persiste, desinstalar manualmente el Python/uv conflictivo primero."
            }
        }
        Write-Host "Instalando podman-compose ($python -m pip install podman-compose)..."
        # "python -m pip" en vez de un 'pip' suelto -- evita depender de que pip.exe en el PATH
        # sea el correcto y no un shim roto de otra herramienta (mismo motivo que Get-PythonFuncional).
        & $python -m pip install podman-compose
        if ($LASTEXITCODE -ne 0) { throw "Fallo '$python -m pip install podman-compose'." }
        Update-PathDeSesion
    }
    Write-Host "podman-compose OK."
}

function New-EnvDeCliente {
    Write-Paso "4. Generando .env de este cliente"
    if (Test-Path $EnvPath) {
        throw "$EnvPath ya existe - este script es para una instalacion NUEVA. Borrar o mover el .env existente si se quiere reinstalar desde cero."
    }
    $contenido = Get-Content $EnvExamplePath -Raw
    # Cada placeholder "cambiar-por-..."/"cambiar-esta-clave..." se reemplaza por un valor
    # aleatorio unico — nunca reusar contraseñas entre clientes (INST-RNF-03). El placeholder con
    # sufijo "-Aa1!" (ZITADEL_ADMIN_PASSWORD) va primero y usa New-ClaveConSimbolo — si el
    # reemplazo generico corriera antes, perderia la garantia de mayuscula/minuscula/digito/
    # simbolo que Zitadel exige para el admin humano.
    $contenido = [regex]::Replace($contenido, 'cambiar-por-una-clave-unica-de-este-cliente-Aa1!', { New-ClaveConSimbolo })
    $contenido = [regex]::Replace($contenido, 'cambiar-por-una-clave-unica-de-este-cliente', { New-ClavealAzar })
    $contenido = [regex]::Replace($contenido, 'cambiar-por-32-caracteres-random', { (New-ClavealAzar).Substring(0, 32) })
    $contenido = $contenido -replace 'cambiar-por-64-caracteres-hex-random', ((1..32 | ForEach-Object { "{0:x2}" -f (Get-Random -Max 256) }) -join '')
    $contenido = $contenido -replace 'admin@sicsaft\.localhost', "admin@$OrganizacionId.sicsaft.localhost"
    Set-Content $EnvPath $contenido -NoNewline
    Write-Host ".env generado con credenciales unicas de este cliente."

    # Si $InstallDir tiene contenedores/volumenes de un intento anterior (ej. una corrida previa
    # que fallo despues de este paso), hay que tirarlos abajo antes de seguir: el compose usa
    # "name: sicsaft-onprem" fijo, asi que los volumenes de Postgres/Zitadel de ese intento previo
    # persistirian con las credenciales VIEJAS aunque el .env recien generado tenga contraseñas
    # nuevas -- Postgres/Zitadel arrancarian con datos ya inicializados con el password anterior,
    # y el resto del stack fallaria la autenticacion contra ellos de forma confusa. "down -v" es
    # seguro aunque no haya nada que tirar (no falla si el proyecto no existe todavia).
    if ((Test-Path $ComposeFile) -and (Get-Command podman-compose -ErrorAction SilentlyContinue)) {
        # Sin redirigir stderr (mismo motivo que el resto del script) -- si no habia nada que
        # tirar, podman-compose puede escribir un aviso a stderr sin que sea un error real.
        podman-compose -f $ComposeFile --project-directory $InstallDir down -v | Out-Null
    }
    if (Test-Path (Split-Path -Parent $PatPath)) {
        Remove-Item -Recurse -Force (Split-Path -Parent $PatPath)
    }
}

function Wait-PatDeZitadel {
    Write-Paso "5. Levantando postgres, redis y zitadel"
    # --project-directory ademas de -f: los "build.context" del compose (ej. "../../cis") son
    # relativos al directorio del proyecto, no necesariamente al cwd del proceso -- mismo motivo
    # que el resto de este script evita depender del cwd.
    podman-compose -f $ComposeFile --project-directory $InstallDir up -d postgres redis zitadel
    if ($LASTEXITCODE -ne 0) { throw "Fallo 'podman-compose up -d postgres redis zitadel'." }

    Write-Host "Esperando el PAT auto-provisionado por Zitadel ($PatPath)..."
    $intentos = 0
    while (-not (Test-Path $PatPath) -and $intentos -lt 24) {
        Start-Sleep -Seconds 5
        $intentos++
    }
    if (-not (Test-Path $PatPath)) {
        throw "No aparecio $PatPath despues de 2 minutos. Revisar 'podman-compose logs zitadel' - el bootstrap de Zitadel (ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*/PATPATH) puede no haber terminado, o el nombre/formato del archivo difiere del esperado (ver Nota de honestidad en docker-compose.yml)."
    }
    $pat = (Get-Content $PatPath -Raw).Trim()
    Write-Host "PAT obtenido."
    return $pat
}

function Set-ValoresEnEnv {
    param([hashtable]$Valores)
    Write-Paso "7. Completando .env con los datos del bootstrap"
    $contenido = Get-Content $EnvPath -Raw
    foreach ($clave in $Valores.Keys) {
        if ($null -eq $Valores[$clave]) { continue }
        $patron = "(?m)^$([regex]::Escape($clave))=.*$"
        $valor = $Valores[$clave]
        # MatchEvaluator (scriptblock) en vez de un string de reemplazo — evita que $/\\ dentro
        # del valor (ej. el JSON de ZITADEL_ORG_ID_MAP) se interpreten como sintaxis de regex.
        $contenido = [regex]::Replace($contenido, $patron, { "$clave=$valor" })
    }
    Set-Content $EnvPath $contenido -NoNewline
    Write-Host ".env completo."
}

function Test-Servicio {
    param([string]$Url, [string]$Nombre)
    $intentos = 0
    while ($intentos -lt 12) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -eq 200) {
                Write-Host "  [OK] $Nombre ($Url)" -ForegroundColor Green
                return $true
            }
        } catch {
            Start-Sleep -Seconds 5
        }
        $intentos++
    }
    Write-Host "  [FAIL] $Nombre ($Url) no respondio 200 despues de 1 minuto" -ForegroundColor Red
    return $false
}

# ============================================================================

Set-HostsLocales
Test-Wsl2
Test-Podman
Test-PodmanCompose
New-EnvDeCliente
$pat = Wait-PatDeZitadel

Write-Paso "6. Corriendo bootstrap de Zitadel (organizacion, proyecto, roles, apps OIDC)"
Import-Module (Join-Path $InstallDir "lib/Bootstrap-Zitadel.psm1") -Force
$valores = Invoke-BootstrapCliente -Pat $pat -ClienteNombre $ClienteNombre `
    -OrganizacionId $OrganizacionId -Nivel $Nivel

Set-ValoresEnEnv -Valores $valores

Write-Paso "8. Construyendo y levantando el stack completo (Nivel $Nivel)"
podman-compose -f $ComposeFile --project-directory $InstallDir --profile "nivel$Nivel" up -d --build
if ($LASTEXITCODE -ne 0) { throw "Fallo 'podman-compose --profile nivel$Nivel up -d --build'." }

Write-Paso "9. Verificacion (smoke check)"
$servicios = @{ "CIS" = "http://api.sicsaft.localhost/health" }
if ($Nivel -eq 2) {
    $servicios["ccp"] = "http://ccp.sicsaft.localhost/"
    $servicios["web-admin"] = "http://admin.sicsaft.localhost/"
    $servicios["core-frontend"] = "http://directivo.sicsaft.localhost/"
}
$todoOk = $true
foreach ($nombre in $servicios.Keys) {
    if (-not (Test-Servicio -Url $servicios[$nombre] -Nombre $nombre)) { $todoOk = $false }
}

Write-Paso "10. Resumen"
if ($todoOk) {
    Write-Host "Instalacion completa para '$ClienteNombre' (Nivel $Nivel)." -ForegroundColor Green
} else {
    Write-Host "Instalacion terminada con al menos un servicio que no respondio - revisar 'podman-compose logs' antes de entregar al cliente." -ForegroundColor Yellow
}
Write-Host "APP QR:    http://qr.sicsaft.localhost"
if ($Nivel -eq 2) {
    Write-Host "CCP:       http://ccp.sicsaft.localhost"
    Write-Host "Admin:     http://admin.sicsaft.localhost"
    Write-Host "Directivo: http://directivo.sicsaft.localhost"
}
Write-Host ""
Write-Host "IMPORTANTE: guardar ZITADEL_ADMIN_TOKEN (en .env) en el gestor de secretos del admin" -ForegroundColor Yellow
Write-Host "antes de irse del sitio - se necesita para soportar esta instalacion despues" -ForegroundColor Yellow
Write-Host "(aidlc-docs/devops/requirements/REQUIREMENTS.md INST-Q-02). Crear las credenciales" -ForegroundColor Yellow
Write-Host "reales del cliente y borrar cualquier usuario de prueba antes de entregar el sistema." -ForegroundColor Yellow
