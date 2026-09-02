# CU-SEG — Seguridad

Dominio §12.27. Componentes: todos los portales (`ccp/`, `web_admin/`, `core/frontend/`,
`app-qr-sicsaft/`), Keycloak. Base: [ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)
(Keycloak self-hosted), `lib/oidc/` (idéntico en los cuatro portales, DOC-023).

---

## CU-SEG-001 — Autenticar Usuario

| Campo | Detalle |
|---|---|
| **Código** | CU-SEG-001 |
| **Nombre** | Autenticar Usuario |
| **Objetivo** | Establecer una sesión válida con los permisos del usuario cargados (§12.27). |
| **Actor principal** | Cualquier actor humano. |
| **Actores secundarios** | Portal (interfaz), Keycloak, CIS. |
| **Precondiciones** | Usuario existente y habilitado en el realm `sicsaft`. |
| **Disparador** | "Iniciar sesión". |
| **Entradas** | Credenciales (usuario + contraseña); segundo factor si la política lo exige. |
| **Flujo principal** | 1. Credenciales. 2. Validación (Keycloak). 3. Verificación de estado de la cuenta. 4. Aplicación de las políticas de seguridad. 5. Creación de la sesión (OIDC authorization code + PKCE). 6. Carga de permisos (roles del token). 7. Acceso al portal. |
| **Reglas aplicables** | Políticas de contraseña y sesión del realm; cambio obligatorio de contraseña temporal al primer login. |
| **Flujos alternativos** | SSO silencioso entre el login embebido del `.exe` y el portal (misma sesión de Keycloak, DOC-028). "Cambiar de usuario" fuerza `prompt=login`. Reconfiguración de red antes del login si cambió la IP (DOC-028 Fase C.1). |
| **Excepciones** | Credenciales inválidas → mensaje genérico, **sin revelar** si el usuario existe. Cuenta deshabilitada → acceso denegado. Timeout del login (Keycloak en frío) → error claro, reintento con "Cambiar de usuario" (fix RF-G: ya no crashea el proceso). |
| **Postcondiciones** | Sesión activa; token con roles por organización; `sessionStorage` (no `localStorage`) en los portales web. |
| **Eventos generados** | Evento de login (Keycloak). |
| **Auditoría** | Login / logout registrados por Keycloak; las operaciones posteriores llevan `usuario` en `auditoria`. |
| **Resultado esperado** | Acceso concedido solo con credenciales válidas y cuenta habilitada. |
| **Componentes** | Portal · Keycloak · CIS. |
| **Prioridad** | Crítica. |
| **Estado en el repo** | 🟢 **Implementado**: OIDC/PKCE real contra Keycloak en los cuatro portales (`lib/oidc/`, cubierto por los únicos tests unitarios de frontend hoy — PKCE/tokens/refresh, DOC-023). Login embebido del `.exe` con detección de rol (`portal-login-service.ts`). MFA/segundo factor: no configurado todavía en el realm — anotarlo si el cliente lo exige. |
