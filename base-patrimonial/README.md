# Base Patrimonial Central (SYS-04)

## Objetivo
Fuente única y oficial de datos del ecosistema: activos, áreas, ubicaciones, responsables,
inventarios, eventos, historial, auditoría, configuración e integraciones. Solo SICSAFT CORE
puede escribir acá — ninguna fuente de captura (APP QR, WEB, RFID, ERP) accede directo.

## Estado
🔲 No iniciado. Carpeta creada como placeholder dentro del plan maestro del ecosistema.

## Dominios previstos
| Dominio | Entidades principales |
|---|---|
| Activos | Asset, Category, Family, Subfamily |
| Organización | Organization |
| Estructura | Area, Location |
| Personas | Responsible, User |
| Inventario | Inventory, Scan, InventoryResult |
| Incidencias | Incident |
| Eventos | Event |
| Historial | AssetHistory |
| Auditoría | AuditLog |
| Seguridad | User, Role, Permission |
| Configuración | SystemParameter |
| Integraciones | Integration, IntegrationLog |

Regla de dominio importante: el historial de activos se mantiene permanentemente, nunca se
reinicia ni se elimina.

## Depende de
Nada técnicamente (es la base), pero el diseño del modelo debe hacerse junto con CORE para no
duplicar decisiones.

## Bloquea
CORE, WEB, CIP — todos leen/escriben (vía CORE) contra este modelo.

## Documentos relacionados
Pendiente: DOC-003 Modelo de dominio SICSAFT, DOC-004 Modelo Base Patrimonial.

## Próximo paso sugerido
Modelar el dominio (diagrama de entidades) antes de elegir motor de base de datos concreto.
