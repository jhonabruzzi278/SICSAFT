; DOC-028 Fase G.5 -- reglas de entrada del Firewall de Windows para la PC madre: el puesto del
; Profesional de AFT (CCP, TCP 8767), la APP QR (TCP 8765), CIS (TCP 56000), Keycloak (TCP 58080)
; y el descubrimiento de la APK (UDP 58765). Solo perfiles Privado y Dominio: nunca en una red
; Publica. Postgres (55432) y los portales de loopback (8766/8768) no se abren: escuchan solo en
; 127.0.0.1.
;
; netsh necesita elevacion. Con la instalacion "para todos los usuarios" el instalador ya corre
; elevado; si se instalo solo para el usuario actual, netsh falla, queda anotado en el detalle y la
; instalacion sigue (Windows pide permiso la primera vez que la app escucha en la red).
; Se borran antes de agregarlas: reinstalar o actualizar no duplica reglas.
;
; Solo ASCII en este archivo a proposito: NSIS lee un .nsh sin BOM con la pagina de codigos ANSI.

!define SICSAFT_FW_TCP "SICSAFT CORE - red local (TCP)"
!define SICSAFT_FW_UDP "SICSAFT CORE - descubrimiento (UDP)"

!macro sicsaftQuitarReglasFirewall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${SICSAFT_FW_TCP}"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${SICSAFT_FW_UDP}"'
  Pop $0
!macroend

!macro customInstall
  !insertmacro sicsaftQuitarReglasFirewall
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${SICSAFT_FW_TCP}" dir=in action=allow protocol=TCP localport=8765,8767,56000,58080 profile=private,domain'
  Pop $0
  ${If} $0 != 0
    DetailPrint "SICSAFT CORE: no se pudieron crear las reglas del firewall (instalacion sin permisos de administrador). Windows pedira permiso la primera vez que la aplicacion use la red."
  ${EndIf}
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${SICSAFT_FW_UDP}" dir=in action=allow protocol=UDP localport=58765 profile=private,domain'
  Pop $0
!macroend

!macro customUnInstall
  !insertmacro sicsaftQuitarReglasFirewall
!macroend
