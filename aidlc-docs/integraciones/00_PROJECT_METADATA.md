# Metadata — Integraciones / CON-CONTABILIDAD

**Fase**: Inception → Construction (diseño cerrado, `DOC-016`; código sin empezar).

**Sistema de código**: `cis/` (módulo nuevo `importacion-contable-conector/`). `integraciones/`
como carpeta de nivel raíz sigue sin código propio — solo su README, corregido en este mismo
incremento (ver ROADMAP.md Fase 7 "Ojo con la clasificación").

## Quick links

- [INTENT.md](requirements/INTENT.md) — qué se pidió, por qué ahora, qué NO es esta fase.
- [REQUIREMENTS.md](requirements/REQUIREMENTS.md) — RF-01 a RF-08, RNF-01 a RNF-05.
- [DOC-016](design-artifacts/DOC-016-conector-con-contabilidad.md) — diseño técnico completo.

## Próximo paso sugerido

Implementar `cis/src/importacion-contable-conector/` según DOC-016 2–7, con tests unitarios
del parseo CSV y del armado de la identidad sintética (5) — sin depender de un sistema contable
real todavía (riesgo aceptado, DOC-016 8). Actualizar `integraciones/README.md` y `cis/README.md`
en el mismo commit que el código, no antes (regla de `CLAUDE.md` "Documentación").
