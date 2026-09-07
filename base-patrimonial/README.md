# BPI — Base Patrimonial Inteligente (SYS-04)

Repositorio oficial y fuente única de la verdad de toda la información patrimonial del ecosistema SICSAFT (Tomo III, Cap. 4; Tomo IV).

## Objetivo

Administrar el ciclo de vida completo de cada Activo Fijo Tangible (AFT), garantizando integridad, inmutabilidad del historial y trazabilidad total.

**Principio de Fuente Única**: Toda modificación oficial del patrimonio se persiste en la BPI a través de SICSAFT CORE. Ninguna fuente de captura (APP QR, CCP, RFID, ERP) interactúa con la base de datos de forma directa.

## Estado

🟡 Modelo de datos implementado en PostgreSQL mediante migraciones versionadas (`core/migrations/`):
- **Entitlements & Contratos** ([DOC-004](DOC-004-modelo-contrato.md)): Tablas `organizaciones`, `sedes`, `contratos` con máquina de estados y unicidad de contrato activo.
- **Modelo Patrimonial Esencial** ([DOC-005](DOC-005-modelo-patrimonial.md)): Tablas `areas`, `ubicaciones`, `responsables`, `catalogo_activos`, `activos`, `sesiones_inventario`, `inventarios`, `eventos_patrimoniales`, `auditoria`.
- **API Transaccional**: Servida por `core/` y expuesta a clientes mediante `cis/`.

## Los 11 Dominios Patrimoniales

| Dominio | Entidades Principales | Objetivo de Negocio |
|---|---|---|
| **BPI (Núcleo Activo)** | `activos` (código patrimonial, QR, RFID, clasificación, estado) | Registro único y ciclo de vida del bien |
| **Catálogo de Activos** | `catalogo_activos` (tipo, marca, modelo, vida útil, criticidad) | Normalización y tipificación de bienes |
| **Áreas** | `areas` (código, nombre, centro de costo) | Estructura organizacional institucional |
| **Responsables** | `responsables` (RUT/identificador, cargo, contacto) | Custodia y asignación de activos |
| **Ubicaciones** | `ubicaciones` (sede, edificio, piso, oficina, zona RFID) | Geolocalización física del bien |
| **Inventarios** | `sesiones_inventario`, `inventarios` | Verificaciones físicas periódicas |
| **Eventos** | `eventos_patrimoniales` (alta, traslado, mantenimiento, baja) | Registro transaccional de cambios |
| **Historial** | Trazabilidad inmutable | Registro histórico permanente que nunca se elimina |
| **Auditoría** | `auditoria` (operador, fecha, IP, operación, resultado) | Evidencia formal de cumplimiento |
| **Configuración** | Parámetros del sistema y políticas | Centralización de variables operativas |
| **Integraciones** | Registro de intercambio con ERPs / sistemas contables | Conciliación e interoperabilidad |

## Jerarquía de Relaciones

```
Áreas → Responsables → Catálogo de Activos → BPI (Activos) → {Inventarios, Eventos, Historial} → Auditoría
```

## Depende de

- **PostgreSQL 16+**: Motor de base de datos relacional y transaccional.
- **SICSAFT CORE**: Componente exclusivo de orquestación y aplicación de reglas patrimoniales.

## Bloquea

- **CIS**, **CCP**, **APP QR**, **CIP**: Todos los subsistemas dependen de la persistencia de BPI para operar.

## Documentos Relacionados

- [`DOC-004-modelo-contrato.md`](DOC-004-modelo-contrato.md) — Modelo de Contrato y Entitlements.
- [`DOC-005-modelo-patrimonial.md`](DOC-005-modelo-patrimonial.md) — Alcance esencial del modelo patrimonial.
- [`../NOMENCLATURA.md`](../NOMENCLATURA.md) — Nomenclatura oficial del ecosistema.
- [`../ARQUITECTURA-WAF.md`](../ARQUITECTURA-WAF.md) — Pilares de resiliencia y seguridad.

