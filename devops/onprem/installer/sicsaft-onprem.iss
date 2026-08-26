; Instalador Windows de SICSAFT onprem (Inno Setup) — copia devops/onprem/ al equipo del cliente,
; pide 3 datos simples (nombre del cliente, id de organizacion, nivel) y corre
; instalar-cliente.ps1 al terminar, que hace todo lo demas (WSL2, Podman, .env, bootstrap de
; Zitadel, build) — ver aidlc-docs/devops/design-artifacts/ARCHITECTURE.md "Fase 3".
;
; NOTA DE HONESTIDAD (corregida 2026-08-25): este .iss SI se compilo y se corrio al menos una vez
; (el bug de $PSScriptRoot vacio de mas abajo solo pudo encontrarse corriendo el .exe compilado,
; no el .ps1 suelto). Lo que sigue sin correrse es contra una VM Windows limpia (sin WSL2/Podman
; preinstalados) — ver installer/README.md "Estado real" para el detalle completo.
;
; Compilar con: iscc sicsaft-onprem.iss  (requiere Inno Setup instalado, https://jrsoftware.org/isinfo.php)

#define MyAppName "SICSAFT Onprem"
#define MyAppVersion "1.0"
#define MyAppPublisher "SICSAFT"

[Setup]
AppId={{8F1A6C2E-9D3B-4E5F-A1C7-3B2D4E5F6A7B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\SICSAFT\Onprem
DefaultGroupName=SICSAFT Onprem
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=sicsaft-onprem-setup
Compression=lzma
SolidCompression=yes
; Requiere permisos de administrador — winget/wsl (usados por instalar-cliente.ps1) los necesitan.
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Files]
; Todo devops/onprem/ menos lo que nunca debe viajar en el instalador: .env real (no existe en
; el repo, solo por si alguien lo generó a mano antes de empaquetar) y .bootstrap/ (secreto
; runtime, se genera en el equipo del cliente, no en el instalador).
Source: "..\*"; DestDir: "{app}"; Excludes: ".env,.bootstrap\*,installer\*"; Flags: recursesubdirs createallsubdirs

[Code]
var
  ClientePage: TInputQueryWizardPage;
  NivelPage: TInputOptionWizardPage;

procedure InitializeWizard;
begin
  ClientePage := CreateInputQueryPage(wpSelectDir,
    'Datos del cliente', 'Información de esta instalación',
    'Completar el nombre de la organización y un identificador corto (sin espacios, ej. "municipalidad-melipilla").');
  ClientePage.Add('Nombre del cliente (ej. Municipalidad de Melipilla):', False);
  ClientePage.Add('Identificador corto (sin espacios):', False);

  // Exclusive=True -- radio buttons (una sola opción posible), no checkboxes. Con False (como
  // estaba antes) se podían marcar los dos niveles a la vez o ninguno, y SelectedValueIndex no
  // se respetaba como default (quedaba tildado el índice 0 igual) -- confirmado visualmente al
  // compilar y correr el instalador una primera vez.
  NivelPage := CreateInputOptionPage(ClientePage.ID,
    'Nivel de producto', 'Qué nivel contrató este cliente',
    'Nivel 1: APP QR + SICSAFT. Nivel 2: Nivel 1 + los 3 portales web.',
    True, False);
  NivelPage.Add('Nivel 1 (APP QR + SICSAFT)');
  NivelPage.Add('Nivel 2 (Nivel 1 + portales web)');
  NivelPage.SelectedValueIndex := 1;
end;

function NivelSeleccionado(): String;
begin
  if NivelPage.SelectedValueIndex = 0 then
    Result := '1'
  else
    Result := '2';
end;

function GetClienteNombre(Param: String): String;
begin
  Result := ClientePage.Values[0];
end;

function GetOrganizacionId(Param: String): String;
begin
  Result := ClientePage.Values[1];
end;

function GetNivel(Param: String): String;
begin
  Result := NivelSeleccionado();
end;

[Run]
; -NoExit para que el técnico vea el resultado del script (WSL2/Podman pueden tardar varios
; minutos) en vez de que la ventana se cierre sola al terminar el instalador.
;
; -InstallDir explícito con "{app}" -- bug real encontrado corriendo el instalador compilado:
; $PSScriptRoot vino vacío en este contexto de invocación (causa exacta no confirmada), lo que
; hacía fallar Set-Location con "cadena vacía" apenas arrancaba el script. En vez de depender de
; que PowerShell autodetecte su propio directorio acá, se lo pasamos nosotros -- Inno Setup ya
; sabe "{app}" en este punto, no hace falta que el script lo adivine.
Filename: "powershell.exe"; \
  Parameters: "-NoExit -ExecutionPolicy Bypass -File ""{app}\instalar-cliente.ps1"" -ClienteNombre ""{code:GetClienteNombre}"" -OrganizacionId ""{code:GetOrganizacionId}"" -Nivel {code:GetNivel} -InstallDir ""{app}"""; \
  Description: "Ejecutar instalar-cliente.ps1 (WSL2, Podman, bootstrap de Zitadel, build)"; \
  Flags: postinstall runascurrentuser
