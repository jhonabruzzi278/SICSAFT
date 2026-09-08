param(
    [Parameter(Position = 0)]
    [ValidateSet("check", "sync", "release", "version", "linear", "install-hooks", "cargar-excel", "reset-cero", "help")]
    [string]$Comando = "help",

    [Parameter(Position = 1)]
    [string]$Param1,

    [switch]$Tag
)

$RootDir = $PSScriptRoot

function Mostrar-Banner {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "       * SICSAFT - CLI Maestro de Automatizacion *          " -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Limpiar-Todo-Cero {
    Mostrar-Banner
    node "$RootDir\herramientas\limpiar-datos-cero.mjs"
}

function Cargar-Excel-Demo {
    param([string]$Archivo)
    Mostrar-Banner
    if (-not $Archivo) {
        $Archivo = "CU-PAT-DIRECCION-COMERCIAL-completo.xlsx"
    }
    node "$RootDir\herramientas\sincronizar-demo-excel.mjs" $Archivo
}


function Ejecutar-Check {
    Mostrar-Banner
    Write-Host "-> [1/4] Verificando consistencia de versiones..." -ForegroundColor Yellow
    node "$RootDir\herramientas\versionado\version-manager.mjs" status

    Write-Host "`n-> [2/4] Ejecutando auditoria arquitectonica e inventario (H-04)..." -ForegroundColor Yellow
    node "$RootDir\herramientas\revision-codigo\inventario.mjs"
    $inv = Get-Content "$RootDir\herramientas\revision-codigo\inventario.json" | ConvertFrom-Json
    if ($inv.totales.huerfanos -gt 0) {
        Write-Host "ERROR: Se encontraron $($inv.totales.huerfanos) comentarios huerfanos." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "  OK: 0 comentarios huerfanos en todo el proyecto (H-04 cumplido)." -ForegroundColor Green
    }
    Write-Host "  OK: $($inv.totales.loc) LoC totales | $($inv.totales.locTests) LoC de tests | $($inv.totales.docs) documentos." -ForegroundColor Green

    Write-Host "`n-> [3/4] Ejecutando suite de tests en CIS..." -ForegroundColor Yellow
    Push-Location "$RootDir\cis"
    bun run test --silent
    $cisExit = $LASTEXITCODE
    Pop-Location
    if ($cisExit -ne 0) {
        Write-Host "ERROR: Fallaron los tests de CIS." -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: 100% tests de CIS pasando." -ForegroundColor Green

    Write-Host "`n-> [4/4] Ejecutando suite de tests en CORE..." -ForegroundColor Yellow
    Push-Location "$RootDir\core"
    bun run test --silent
    $coreExit = $LASTEXITCODE
    Pop-Location
    if ($coreExit -ne 0) {
        Write-Host "ERROR: Fallaron los tests de CORE." -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: 100% tests de CORE pasando." -ForegroundColor Green

    Write-Host "`nOK: Todas las verificaciones de calidad pasaron exitosamente!" -ForegroundColor Green
}

function Ejecutar-Sync {
    Mostrar-Banner
    Write-Host "-> [1/2] Sincronizando versiones de paquetes..." -ForegroundColor Yellow
    node "$RootDir\herramientas\versionado\version-manager.mjs" sync

    Write-Host "`n-> [2/2] Sincronizando proyectos e issues con Linear..." -ForegroundColor Yellow
    $apiKey = if ($env:LINEAR_API_KEY) { $env:LINEAR_API_KEY } else { "" }
    $env:LINEAR_API_KEY = $apiKey
    node "$RootDir\herramientas\revision-codigo\linear-sync.mjs" --team-key JON --apply

    Write-Host "`nOK: Sincronizacion total completada!" -ForegroundColor Green
}

function Ejecutar-Release {
    param([string]$TipoBump)
    Mostrar-Banner
    if (-not $TipoBump) { $TipoBump = "patch" }

    Write-Host "-> Iniciando proceso de release ($TipoBump)..." -ForegroundColor Yellow

    Write-Host "`n[1/3] Incrementando version..." -ForegroundColor Cyan
    node "$RootDir\herramientas\versionado\version-manager.mjs" bump $TipoBump --tag

    Write-Host "`n[2/3] Sincronizando nuevo estado con Linear..." -ForegroundColor Cyan
    $apiKey = if ($env:LINEAR_API_KEY) { $env:LINEAR_API_KEY } else { "" }
    $env:LINEAR_API_KEY = $apiKey
    node "$RootDir\herramientas\revision-codigo\linear-sync.mjs" --team-key JON --apply

    Write-Host "`n[3/3] Verificando tests post-release..." -ForegroundColor Cyan
    Push-Location "$RootDir\cis"
    bun run test --silent
    Pop-Location
    Push-Location "$RootDir\core"
    bun run test --silent
    Pop-Location

    $nuevaVer = (Get-Content "$RootDir\VERSION").Trim()
    Write-Host "`nOK: Release v$nuevaVer completado y sincronizado con exito!" -ForegroundColor Green
}

function Instalar-GitHooks {
    Mostrar-Banner
    Write-Host "-> Instalando Git Hooks automaticos..." -ForegroundColor Yellow

    $hooksDir = Join-Path $RootDir ".git\hooks"
    $sourceDir = Join-Path $RootDir ".githooks"

    if (-not (Test-Path $hooksDir)) {
        Write-Host "ERROR: No se encontro la carpeta .git/hooks." -ForegroundColor Red
        exit 1
    }

    Copy-Item -Path "$sourceDir\pre-commit" -Destination "$hooksDir\pre-commit" -Force
    Copy-Item -Path "$sourceDir\commit-msg" -Destination "$hooksDir\commit-msg" -Force

    Write-Host "  OK: Hook pre-commit instalado (bloquea comentarios huerfanos)." -ForegroundColor Green
    Write-Host "  OK: Hook commit-msg instalado (valida Conventional Commits y [JON-XX])." -ForegroundColor Green
    Write-Host "`nOK: Git Hooks activados con exito!" -ForegroundColor Green
}

if ($Comando -eq "check") {
    Ejecutar-Check
} elseif ($Comando -eq "sync") {
    Ejecutar-Sync
} elseif ($Comando -eq "release") {
    Ejecutar-Release $Param1
} elseif ($Comando -eq "version") {
    node "$RootDir\herramientas\versionado\version-manager.mjs" $Param1
} elseif ($Comando -eq "linear") {
    $apiKey = if ($env:LINEAR_API_KEY) { $env:LINEAR_API_KEY } else { "" }
    $env:LINEAR_API_KEY = $apiKey
    node "$RootDir\herramientas\revision-codigo\linear-sync.mjs" --team-key JON --apply
} elseif ($Comando -eq "install-hooks") {
    Instalar-GitHooks
} elseif ($Comando -eq "cargar-excel") {
    Cargar-Excel-Demo $Param1
} elseif ($Comando -eq "reset-cero") {
    Limpiar-Todo-Cero
} else {
    Mostrar-Banner
    Write-Host "Comandos disponibles:" -ForegroundColor Cyan
    Write-Host "  .\sicsaft.ps1 check          - Valida calidad, comentarios huerfanos y corre todos los tests"
    Write-Host "  .\sicsaft.ps1 sync           - Sincroniza versiones de todos los paquetes y Linear"
    Write-Host "  .\sicsaft.ps1 release patch  - Sube version patch, actualiza changelog, crea tag y sincroniza Linear"
    Write-Host "  .\sicsaft.ps1 release minor  - Sube version minor, actualiza changelog, crea tag y sincroniza Linear"
    Write-Host "  .\sicsaft.ps1 install-hooks  - Instala Git Hooks automaticos para pre-commit y commit-msg"
    Write-Host "  .\sicsaft.ps1 linear         - Sincronizacion directa con Linear"
    Write-Host "  .\sicsaft.ps1 cargar-excel   - Sincroniza los portales y app QR con un Excel (ej. CU-PAT-DIRECCION-COMERCIAL-completo.xlsx)"
    Write-Host "  .\sicsaft.ps1 reset-cero     - Vacia todos los datos y deja el sistema 100% limpio desde cero"
    Write-Host ""
}

