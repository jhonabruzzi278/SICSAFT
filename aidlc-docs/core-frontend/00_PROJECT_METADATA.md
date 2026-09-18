# Core Frontend (Portal Directivo) — Metadata del Proyecto

> 📌 **Resumen Rápido (Lectura en 30s)**:
> - **¿Qué es?**: La aplicación web institucional diseñada exclusivamente para **Directores, Gerentes y Autoridades** de la organización (React 19, Vite, servida en el puerto 8768 por `sicsaft-core.exe`).
> - **Para qué sirve**:
>   1. **Organigrama de Controles de Área**: Visualizar la jerarquía Organización → Dirección → Departamento → Área con el conteo de relevamientos realizados.
>   2. **Reportes Oficiales en PDF**: Descargar informes ejecutivos de control patrimonial y estado de sesiones con veredictos de color (verde, amarillo, rojo).
>   3. **Dashboards Ejecutivos**: Monitorear KPIs de cobertura patrimonial, veredictos de inventario e incidencias graves.
>   4. **Designar Profesional de AFT**: Asignar al responsable operativo de AFT dentro de su propia organización.
> - **Seguridad**: Acceso protegido con el rol Keycloak `directivo`. Por diseño, el directivo **no puede alterar registros patrimoniales ni cerrar inventarios** (solo consulta y gobernanza).

---

## 1. Quick Links y Documentos Relacionados

- **README del Sistema**: [`core/frontend/README.md`](../../core/frontend/README.md) — Estructura de código, componentes y scripts.
- **Organigrama y Generador de PDF**: [`aidlc-docs/core/design-artifacts/DOC-035-organigrama-controles-de-area.md`](../core/design-artifacts/DOC-035-organigrama-controles-de-area.md) — Especificación de la jerarquía de área y exportación PDF.
- **Decisión de Separación de Portal**: [`adr/ADR-003-frontend-de-core-para-directivo.md`](../../adr/ADR-003-frontend-de-core-para-directivo.md) — Por qué el Directivo tiene un portal web independiente del CCP.
- **Segmentación por Rol Directivo**: [`aidlc-docs/ccp/design-artifacts/DOC-020-segmentacion-por-rol-directivo.md`](../ccp/design-artifacts/DOC-020-segmentacion-por-rol-directivo.md) — Aislamiento de permisos respecto al operador de AFT.
- **Reestructuración de Portales**: [`aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md`](../ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — Asignación de puertos y flujos de acceso.
