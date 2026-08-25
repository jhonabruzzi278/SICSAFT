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

.PARAMETER DominioBase
    Dominio local de este cliente (ej. "sicsaft-duoc-melipilla.test") — reemplaza el genérico
    "sicsaft.localhost" en hosts, Traefik, Zitadel y las URLs que hornean los frontends. Si no se
    pasa, se calcula automáticamente a partir de -ClienteNombre: "sicsaft-" + slug del nombre
    (minúsculas, sin acentos ni espacios) + ".test" (RFC 2606, reservado para uso local, nunca
    resuelve por internet).

.EXAMPLE
    ./instalar-cliente.ps1 -ClienteNombre "Municipalidad de Melipilla" `
        -OrganizacionId "municipalidad-melipilla" -Nivel 2
#>
param(
    [Parameter(Mandatory = $true)][string]$ClienteNombre,
    [Parameter(Mandatory = $true)][string]$OrganizacionId,
    [Parameter(Mandatory = $true)][ValidateSet(1, 2)][int]$Nivel,
    [string]$InstallDir = $PSScriptRoot,
    [string]$DominioBase
)

$ErrorActionPreference = "Stop"

function New-DominioDesdeNombre {
    # Slug DNS-safe: minusculas, sin acentos, espacios/simbolos -> guion, guiones repetidos
    # colapsados, sin guion al inicio/final. ".test" (RFC 2606) nunca resuelve por internet ni
    # choca con mDNS/Bonjour (a diferencia de ".local") -- pensado para que cada cliente onprem
    # tenga sus propias URLs (ej. qr.duoc-melipilla.test) en vez del generico sicsaft.localhost.
    param([string]$Nombre)
    $normalizado = $Nombre.Normalize([System.Text.NormalizationForm]::FormD)
    $sinAcentos = -join ($normalizado.ToCharArray() | Where-Object {
        [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark
    })
    $slug = ($sinAcentos.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    if (-not $slug) { $slug = "cliente" }
    return "sicsaft-$slug.test"
}

if (-not $DominioBase) {
    $DominioBase = New-DominioDesdeNombre -Nombre $ClienteNombre
}

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
$DynamicYmlPath = Join-Path $InstallDir "traefik\dynamic.yml"
$DynamicYmlTemplatePath = Join-Path $InstallDir "traefik\dynamic.yml.template"
$LogPath = Join-Path $InstallDir "instalacion.log"

# Deja un registro en archivo de toda la corrida -- necesario para poder diagnosticar despues
# (soporte remoto, o cuando en el futuro la ventana deje de mostrarse en vivo, ver
# aidlc-docs/devops/requirements/REQUIREMENTS.md "cuando este listo se oculta la ventana, el
# cliente no debe tener acceso al codigo/secretos"). Ningun Write-Host de este script imprime un
# secreto real (contraseñas/PAT) -- solo referencias a "ver .env" -- asi que el log tampoco los
# contiene; igual se le restringen permisos al final (ver Protect-Archivo) por las dudas.
Start-Transcript -Path $LogPath -Append | Out-Null

function Protect-Archivo {
    # Restringe un archivo/carpeta a Administradores + SYSTEM (SIDs conocidos, no el nombre del
    # grupo -- que varia segun el idioma de Windows) -- para que una sesion sin privilegios de
    # administrador en el PC del cliente no pueda ni abrir .env/.bootstrap ni leer el log.
    # icacls en vez de Set-Acl: mas simple de razonar y mas facil de verificar a mano
    # (`icacls archivo`) si algo no quedo como se espera.
    param([string]$Ruta)
    if (-not (Test-Path $Ruta)) { return }
    icacls $Ruta /inheritance:r | Out-Null
    icacls $Ruta /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Aviso: no se pudieron restringir los permisos de '$Ruta' (icacls fallo). Revisar manualmente." -ForegroundColor Yellow
    }
}

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
    # web-admin y core-frontend van siempre desde Nivel 1 (DOC-025 §1, revisado 2026-08-25); ccp
    # (portal COMPLETO de AFT) sigue siendo exclusivo de Nivel 2.
    $dominios = @("id.$DominioBase", "api.$DominioBase", "qr.$DominioBase", "admin.$DominioBase", "directivo.$DominioBase")
    if ($Nivel -eq 2) {
        $dominios += @("ccp.$DominioBase")
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

function Set-DominioTraefik {
    # traefik/dynamic.yml no admite interpolacion de variables de entorno (a diferencia de
    # docker-compose.yml) -- Traefik lo lee tal cual desde el provider "file". Se regenera SIEMPRE
    # desde dynamic.yml.template (placeholder "__DOMINIO_BASE__", nunca un dominio real) en vez de
    # reemplazar en el archivo final -- bug real evitado a proposito: reemplazar sobre dynamic.yml
    # directamente es idempotente solo la PRIMERA vez; si una corrida posterior usa un
    # -DominioBase distinto, "sicsaft.localhost" ya no estaria en el archivo para encontrar y
    # reemplazar, y Traefik quedaria enrutando al dominio viejo en silencio.
    Write-Paso "0b. Configurando dominio de Traefik"
    if (-not (Test-Path $DynamicYmlTemplatePath)) {
        throw "No se encontro $DynamicYmlTemplatePath : reinstalar devops/onprem/ desde el repo."
    }
    $contenido = Get-Content $DynamicYmlTemplatePath -Raw
    $contenido = $contenido -replace [regex]::Escape('__DOMINIO_BASE__'), $DominioBase
    Set-Content $DynamicYmlPath $contenido -NoNewline
    Write-Host "traefik/dynamic.yml generado para *.$DominioBase."
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
        # "throw" en vez de "exit 1" -- "exit" corta el proceso entero sin pasar por el bloque
        # "finally" de mas abajo (Stop-Transcript/Protect-Archivo del log no correrian).
        throw "WSL2 recien instalado, reiniciar y volver a correr."
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
    # "2>$null" + try/catch, no solo "sin redireccion" -- bug real encontrado corriendo el
    # instalador elevado (Start-Process -Verb RunAs, ej. desde un wrapper o soporte remoto): bajo
    # ese tipo de invocacion, PowerShell SI convierte el stderr de podman ("already running") en
    # un NativeCommandError terminante pese a $ErrorActionPreference="Stop" nunca haber cambiado
    # -- la consola de un proceso elevado via ShellExecute maneja el stream de error distinto que
    # una consola interactiva normal. Confiar en "no redirigir" ya no alcanza en todos los
    # contextos de invocacion.
    try { podman machine start 2>$null | Out-Null } catch { }

    # Bug real encontrado corriendo el instalador: la maquina de Podman en WSL2 corre en modo
    # rootless, y por default Linux no deja a un proceso sin privilegios bindear puertos < 1024
    # (net.ipv4.ip_unprivileged_port_start = 1024). Traefik publica el 80 ("80:80" en
    # docker-compose.yml, ver comentario ahi) para que las URLs *.sicsaft.localhost no necesiten
    # puerto -- sin este ajuste, "podman-compose up" de Traefik fallaba con "rootlessport cannot
    # expose privileged port 80: bind: permission denied". Idempotente: sysctl -w no falla si ya
    # esta seteado, y el archivo en sysctl.d persiste el valor entre reinicios de la maquina.
    #
    # "tee" en vez de "sudo sh -c '... > archivo ...'" -- segundo bug real encontrado: "podman
    # machine ssh -- sudo sh -c \"... > archivo\"" llegaba al shell remoto con las comillas
    # perdidas (podman/ssh reconstruye el comando remoto uniendo argumentos, no preserva quoting
    # anidado como un shell local), asi que el "sudo" terminaba cubriendo solo "sh -c echo" y la
    # redireccion ">" corria SIN privilegios en el shell exterior -- "Permission denied" al
    # escribir en /etc/sysctl.d. "sudo tee" evita el problema porque no depende de que la
    # redireccion de shell quede dentro del alcance de sudo: tee mismo es el proceso elevado.
    $comandoSysctl = "sudo sh -c 'echo net.ipv4.ip_unprivileged_port_start=80 | tee /etc/sysctl.d/99-podman-rootless-port80.conf > /dev/null && sysctl -w net.ipv4.ip_unprivileged_port_start=80'"
    podman machine ssh -- $comandoSysctl | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo habilitar el puerto 80 sin privilegios dentro de la maquina Podman ('podman machine ssh ... sysctl'). Sin esto, Traefik no puede levantar. Revisar 'podman machine ssh' manualmente."
    }
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
    $contenido = $contenido -replace 'cambiar-por-dominio-base-de-este-cliente', $DominioBase
    $contenido = $contenido -replace 'admin@sicsaft\.localhost', "admin@$DominioBase"
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
        podman-compose -f $ComposeFile down -v | Out-Null
    }
    if (Test-Path (Split-Path -Parent $PatPath)) {
        Remove-Item -Recurse -Force (Split-Path -Parent $PatPath)
    }
}

function Wait-PatDeZitadel {
    Write-Paso "5. Levantando postgres, redis y zitadel"
    # Sin "--project-directory": bug real encontrado -- a diferencia de docker compose,
    # podman-compose 1.6.0 no tiene esa flag (su parser la confunde con el subcomando y tira
    # "invalid choice"). "-f" con ruta absoluta alcanza: podman-compose resuelve los
    # "build.context" relativos del compose (ej. "../../cis") contra el directorio del archivo
    # -f, y Set-Location $InstallDir (arriba) ya deja el cwd correcto de todos modos.
    # "| Out-Null" es necesario, no cosmetico: sin el, la salida de este comando externo se mezcla
    # con "return $pat" de abajo (todo lo no capturado dentro de una funcion de PowerShell va al
    # stream de salida) -- bug real encontrado corriendo el instalador: $pat terminaba siendo un
    # array con todas las lineas de progreso del pull de imagenes en vez de un string, y
    # "Invoke-BootstrapCliente -Pat $pat" fallaba con "no se puede convertir el valor al tipo
    # System.String".
    #
    # "traefik" tiene que estar arriba en este punto tambien -- bug real encontrado corriendo el
    # instalador: zitadel no publica ningun puerto al host, solo es alcanzable via Traefik
    # (id.sicsaft.localhost -> :80 de traefik, ver docker-compose.yml). Sin traefik, el bootstrap
    # de abajo (Invoke-BootstrapCliente, que le pega a la Management API desde el HOST) fallaba
    # con "No es posible conectar con el servidor remoto".
    podman-compose -f $ComposeFile up -d postgres redis zitadel traefik | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Fallo 'podman-compose up -d postgres redis zitadel traefik'." }

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

try {

Set-HostsLocales
Set-DominioTraefik
Test-Wsl2
Test-Podman
Test-PodmanCompose
New-EnvDeCliente
$pat = Wait-PatDeZitadel

# Bug real encontrado corriendo el instalador: el PAT se escribe a disco durante el arranque de
# Zitadel (start-from-init), pero eso no garantiza que su servidor HTTP ya este aceptando
# requests -- Wait-PatDeZitadel solo espera el archivo, no que la API responda. Sin esto, el
# primer llamado del bootstrap (Invoke-BootstrapCliente) llegaba antes de tiempo y Traefik
# devolvia "502 Bad Gateway" (Traefik arriba y enrutando bien, pero sin poder conectarse todavia
# al backend). El endpoint de discovery OIDC no requiere autenticacion y solo responde 200 cuando
# Zitadel esta realmente sirviendo trafico.
if (-not (Test-Servicio -Url "http://id.$DominioBase/.well-known/openid-configuration" -Nombre "Zitadel (API)")) {
    throw "Zitadel no respondio en http://id.$DominioBase/.well-known/openid-configuration despues de 1 minuto. Revisar 'podman-compose logs zitadel' y 'podman-compose logs traefik'."
}

Write-Paso "6. Corriendo bootstrap de Zitadel (organizacion, proyecto, roles, apps OIDC)"
Import-Module (Join-Path $InstallDir "lib/Bootstrap-Zitadel.psm1") -Force
$valores = Invoke-BootstrapCliente -Pat $pat -ClienteNombre $ClienteNombre `
    -OrganizacionId $OrganizacionId -Nivel $Nivel -DominioBase $DominioBase

Set-ValoresEnEnv -Valores $valores

Write-Paso "8. Construyendo y levantando el stack completo (Nivel $Nivel)"
# Bug real encontrado corriendo el instalador: proteger .env ANTES de este paso (como decia el
# comentario original, "para que quede protegido el mayor tiempo posible") rompe este mismo paso
# -- podman-compose todavia necesita LEER .env aca (interpola sus variables en el compose y en
# los contenedores), y con el archivo restringido a Administradores+SYSTEM el proceso de Python
# de podman-compose fallaba con "PermissionError: [Errno 13] Permission denied" al abrirlo. .env
# se protege mas abajo, despues de que este paso ya no lo necesita.
podman-compose -f $ComposeFile --profile "nivel$Nivel" up -d --build
if ($LASTEXITCODE -ne 0) { throw "Fallo 'podman-compose --profile nivel$Nivel up -d --build'." }

# .env y el PAT auto-provisionado (.bootstrap/) ya cumplieron su funcion en este script -- recien
# ahora se restringen, una vez que nada mas en la instalacion necesita leerlos.
Protect-Archivo -Ruta $EnvPath
Protect-Archivo -Ruta (Split-Path -Parent $PatPath)

Write-Paso "9. Verificacion (smoke check)"
$servicios = @{
    "CIS"           = "http://api.$DominioBase/health"
    "web-admin"     = "http://admin.$DominioBase/"
    "core-frontend" = "http://directivo.$DominioBase/"
}
if ($Nivel -eq 2) {
    $servicios["ccp"] = "http://ccp.$DominioBase/"
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
Write-Host "APP QR:    http://qr.$DominioBase"
Write-Host "Admin:     http://admin.$DominioBase"
Write-Host "Directivo: http://directivo.$DominioBase"
if ($Nivel -eq 2) {
    Write-Host "CCP:       http://ccp.$DominioBase"
}
Write-Host ""
Write-Host "IMPORTANTE: guardar ZITADEL_ADMIN_TOKEN (en .env) en el gestor de secretos del admin" -ForegroundColor Yellow
Write-Host "antes de irse del sitio - se necesita para soportar esta instalacion despues" -ForegroundColor Yellow
Write-Host "(aidlc-docs/devops/requirements/REQUIREMENTS.md INST-Q-02). Crear las credenciales" -ForegroundColor Yellow
Write-Host "reales del cliente y borrar cualquier usuario de prueba antes de entregar el sistema." -ForegroundColor Yellow

} finally {
    # Corre siempre, haya terminado bien o el script haya fallado a mitad de camino (por eso
    # "throw" en vez de "exit" en Test-Wsl2) -- deja el log protegido en cualquier caso, no solo
    # en el camino feliz.
    Stop-Transcript | Out-Null
    Protect-Archivo -Ruta $LogPath
}
