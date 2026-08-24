// DOC-024 4 — transcripción de DOC-023 §2 (aidlc-docs/ccp/design-artifacts/DOC-023-matriz-
// permisos-rbac.md), la matriz Rol × Módulo × Acción extraída del código real (guards de cis/src/
// y core/src/orquestador/orquestador.service.ts). Pantalla de solo lectura — decidido
// explícitamente con el usuario (no un motor de roles dinámico): esto solo hace visibles los 3
// roles fijos que ya existen, no permite crear uno nuevo. Si algún guard cambia, este archivo debe
// actualizarse a mano junto con DOC-023 — no se deriva automáticamente del backend.

export type Acceso = 'si' | 'no' | 'lectura';

export interface FilaPermiso {
  modulo: string;
  accion: string;
  patrimonial: Acceso;
  sistema: Acceso;
  directivo: Acceso;
  mecanismo: string;
}

export const MATRIZ_PERMISOS: FilaPermiso[] = [
  {
    modulo: 'Activos',
    accion: 'Alta / baja / reincorporación',
    patrimonial: 'si',
    sistema: 'no',
    directivo: 'no',
    mecanismo: 'verificarRolAdministradorPatrimonial (Orquestador)',
  },
  {
    modulo: 'Catálogo de tipos, documentos, importaciones',
    accion: 'Crear / adjuntar / ejecutar',
    patrimonial: 'si',
    sistema: 'no',
    directivo: 'no',
    mecanismo: 'verificarRolAdministradorPatrimonial (Orquestador)',
  },
  {
    modulo: 'Áreas / ubicaciones / responsables',
    accion: 'Crear / modificar',
    patrimonial: 'si',
    sistema: 'no',
    directivo: 'no',
    mecanismo: 'verificarRolAdministradorPatrimonial (Orquestador)',
  },
  {
    modulo: 'Contratos',
    accion: 'Crear / cambiar estado / editar condiciones',
    patrimonial: 'si',
    sistema: 'si',
    directivo: 'no',
    mecanismo: 'verificarRolesPermitidos([admin-patrimonial, admin-sistema])',
  },
  {
    modulo: 'Sedes',
    accion: 'Crear / dar de baja',
    patrimonial: 'si',
    sistema: 'si',
    directivo: 'no',
    mecanismo: 'verificarRolesPermitidos([admin-patrimonial, admin-sistema])',
  },
  {
    modulo: 'Organizaciones',
    accion: 'Crear / editar / dar de baja',
    patrimonial: 'no',
    sistema: 'si',
    directivo: 'no',
    mecanismo: 'verificarRolEnCualquierOrganizacion([admin-sistema])',
  },
  {
    modulo: 'Usuarios de una organización',
    accion: 'Consultar / asignar / quitar rol / desactivar',
    patrimonial: 'no',
    sistema: 'si',
    directivo: 'no',
    mecanismo: 'AdministradorSistemaGuard (rol contra el :orgId de la ruta)',
  },
  {
    modulo: 'Profesional de AFT (org. propia)',
    accion: 'Consultar / designar',
    patrimonial: 'no',
    sistema: 'no',
    directivo: 'si',
    mecanismo: 'DirectivoGuard (organización siempre del JWT, nunca de la ruta)',
  },
  {
    modulo: 'Indicadores de plataforma',
    accion: 'Consultar',
    patrimonial: 'no',
    sistema: 'si',
    directivo: 'no',
    mecanismo: 'AdministradorSistemaEnCualquierOrganizacionGuard',
  },
  {
    modulo: 'Auditoría',
    accion: 'Consultar (patrimonial + identidad)',
    patrimonial: 'lectura',
    sistema: 'lectura',
    directivo: 'no',
    mecanismo: 'Lectura abierta a cualquier operador autenticado',
  },
  {
    modulo: 'Dashboard (CIP)',
    accion: 'Consultar',
    patrimonial: 'lectura',
    sistema: 'no',
    directivo: 'lectura',
    mecanismo: 'Lectura abierta a cualquier operador autenticado',
  },
  {
    modulo: 'Inventarios (sesiones QR/RFID)',
    accion: 'Crear / consultar',
    patrimonial: 'lectura',
    sistema: 'no',
    directivo: 'no',
    mecanismo: 'Sin chequeo de rol — módulo de fuente de captura',
  },
];
