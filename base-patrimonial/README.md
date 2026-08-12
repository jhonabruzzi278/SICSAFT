# Base Patrimonial Central (SYS-04)

## Objetivo
Repositorio oficial de toda la información patrimonial (Tomo III, Cap. 4). No almacena solo
inventarios: administra el ciclo completo de vida de cada Activo Fijo Tangible. Principio
(Base Única de la Verdad / Single Source of Truth): toda modificación oficial del patrimonio se
hace sobre esta base; ningún otro sistema puede reemplazarla. Solo SICSAFT CORE puede escribir
acá — ninguna fuente de captura (APP QR, WEB, RFID, ERP) accede directo.

## Estado
🟡 Modelo de dominio de `Contrato` documentado (ver
[DOC-004](DOC-004-modelo-contrato.md)) — desbloquea la resolución real de entitlements en CIS.
El resto del dominio patrimonial (los 11 dominios de abajo) sigue sin modelar ni implementar, y
no hay motor de base de datos elegido todavía.

## Los 11 dominios oficiales (Tomo III §4.2–4.13)
La Base Patrimonial Central es el dominio raíz; los otros 10 dominios conviven a su alrededor y
comparten un modelo único de identificación.

| Dominio | Contenido / entidades | Objetivo |
|---|---|---|
| **Base Patrimonial Central** | Identificador único, código patrimonial, código QR, RFID, clasificación, estado, responsable, área, ubicación, valor patrimonial, fechas, documentación, historial | Núcleo — ciclo de vida completo del activo |
| Catálogo de Activos | Tipo, Familia, Subfamilia, Marca, Modelo, Serie, Fabricante, Vida útil, Estado operativo, Criticidad, Tecnología de identificación | Ficha patrimonial única y estandarizada por activo |
| Áreas | Código, Nombre, Dependencia, Centro de costo, Responsable, Ubicación principal | Estructura organizacional — un área contiene múltiples activos |
| Responsables | Identificación, Nombre, Cargo, Área, Correo, Teléfono, Estado | Custodia/uso del activo — cada activo tiene un responsable vigente |
| Ubicaciones | Sede, Edificio, Piso, Área, Oficina, Dependencia, Coordenadas (futuro), Zona RFID | Localización física del activo |
| Inventarios | Fecha, Usuario, Método (QR/RFID/WEB), Resultado, Observaciones | Historial permanente de verificaciones físicas |
| Eventos | Alta, Traslado, Escaneo QR, Lectura RFID, Cambio de responsable, Mantenimiento, Movimiento, Salida autorizada/no autorizada, Baja, Reincorporación | Base para alertas y auditorías |
| Historial | Todos los eventos desde alta hasta baja definitiva | **Nunca se elimina, nunca se reinicia** — cada activo construye su propia historia |
| Auditoría | Usuario, Fecha, Hora, Equipo, IP, Operación, Resultado, Observaciones | Trazabilidad absoluta de toda acción del ecosistema |
| Configuración | Usuarios, Roles, Permisos, Catálogos, Parámetros RFID/QR, Alertas, Plantillas, Políticas, Integraciones | Centraliza parámetros de funcionamiento (identidad/RBAC coordina con `../seguridad`) |
| Integraciones | Fecha, Origen, Destino, Estado, Resultado, Errores — sistemas: ERP, Contabilidad, RRHH, Correo, Power BI, Cloud, RFID, APIs | Control único de todo intercambio con plataformas externas |

## Jerarquía de relaciones (Tomo III §4.14)
`Áreas → Responsables → Catálogo de Activos → Base Patrimonial Central → {Inventarios, Eventos,
Historial} → Auditoría → Configuración → Integraciones`. Ninguna entidad opera de forma aislada.

## Ciclo de vida de un activo (Tomo III §4.15)
`Alta → Registro Patrimonial → Asignación QR → Asignación RFID (si aplica) → Asignación
Responsable → Ubicación → Inventarios → Eventos → Movimientos → Auditorías → Mantenimiento
(módulo futuro) → Baja → Conservación Histórica Permanente`.

## Depende de
Nada técnicamente (es la base), pero el diseño del modelo debe hacerse junto con CORE para no
duplicar decisiones — así se hizo para `Contrato` ([DOC-004](DOC-004-modelo-contrato.md)), queda
como patrón para el resto del dominio.

## Bloquea
CORE, WEB, CIP — todos leen/escriben (vía CORE) contra este modelo. `Contrato` puntualmente
bloquea la resolución real de entitlements en CIS (ver DOC-004 §6).

## Documentos relacionados
[DOC-004](DOC-004-modelo-contrato.md) — modelo de `Contrato` (entregado, no implementado).
Pendiente: DOC-003 Modelo de dominio SICSAFT, DOC-005 resto del modelo Base Patrimonial (los 11
dominios de arriba salvo Contrato).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §5 (rendimiento: separar lectura transaccional
de analítica) y §4 (fiabilidad: backups con restauración probada dado que el historial nunca se
borra).

## Próximo paso sugerido
`Contrato` ya está modelado (DOC-004) — validarlo con quien defina CORE antes de elegir motor de
BD. Para el resto del dominio: modelar el resto de entidades (diagrama completo, en conjunto con
CORE) antes de elegir motor de base de datos concreto. Tarjeta Trello: `BASE-DOC-001`.
