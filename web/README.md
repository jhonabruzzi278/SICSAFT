# Portal WEB SICSAFT (SYS-05)

## Objetivo
Aplicación web privada de administración y operación patrimonial (no confundir con APP QR, que
es la app móvil de captura). Consume datos vía CIS/CORE.

## Estado
🔲 Sin código todavía — pero con **diseño AI-DLC completo** para el MVP de Fase 5 (adelantado por
pedido explícito del usuario): requirements, historias de usuario, arquitectura y contrato de
módulos en [`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md), incluido un mockup visual (hub +
Activos + Contratos, paleta de `BRAND.md`). Bloqueado para construir hasta que Fase 3 (CIS real)
y Fase 4 (Administrador Patrimonial) existan.

## Módulos previstos
6 en el MVP de Fase 5 (ver [DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md)):
Activos, Inventarios, Áreas/Ubicaciones/Responsables, Auditoría, Contratos, hub. El resto —
Dashboard, Incidencias, Movimientos, QR, RFID, Documentos, Reportes, Usuarios, Roles,
Configuración, Integraciones — queda para después, sin diseñar todavía (sin consumidor real).

## Roles previstos
Administrador, Responsable Patrimonial, Operador, Supervisor, Auditor, Directivo.

## Depende de
CORE (MVP de inventarios) y CIS (autenticación real).

## Bloquea
Nada crítico — puede arrancar en paralelo con un mock del CORE.

## Documentos relacionados
[DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md) — módulos MVP y contra qué endpoint
de CIS/CORE pega cada uno (entregado, diseño adelantado, sin construir).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §8 (WEB y APP QR son clientes intercambiables
del mismo contrato de CIS/CORE).

## Próximo paso sugerido
El diseño (`aidlc-docs/`) ya está listo. Construir queda bloqueado hasta `ROADMAP.md` Fase 3
(CIS real) y Fase 4 (Administrador Patrimonial) — recién ahí Activos/Contratos tienen un
endpoint de escritura real contra el cual apuntar (ver DOC-013 §3, "nota honesta").
