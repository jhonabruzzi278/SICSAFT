// Constantes compartidas por global-setup, el seed de Keycloak y las specs. Un único lugar donde
// viven el dominio, la organización y los usuarios de laboratorio.
//
// La organización es `duoc-uc` a propósito: es el caso que el seed dev de CORE crea
// (core/migrations/1755000000001_seed-dev-fixture.ts, gateado por SICSAFT_SEED_DEV=1 en
// docker-compose.yml). El alias de la Organization en Keycloak se crea con este MISMO id para que
// el claim `organization` del JWT calce con los datos que ya tiene CORE.

export const DOMINIO_BASE = 'sicsaft.localhost';

export const ORG_ID = 'duoc-uc';
export const ORG_NOMBRE = 'DUOC UC';
export const SEDE_ID = 'melipilla';

export const URLS = {
  keycloak: `http://id.${DOMINIO_BASE}`,
  keycloakIssuer: `http://id.${DOMINIO_BASE}/realms/sicsaft`,
  cis: `http://api.${DOMINIO_BASE}`,
  ccp: `http://ccp.${DOMINIO_BASE}`,
  directivo: `http://directivo.${DOMINIO_BASE}`,
};

// Passwords fijas y NO temporales (temporary:false + emailVerified:true + requiredActions:[] en el
// seed) — el harness necesita entrar sin el "actualizá tu contraseña" del primer login que sí
// aplica en una instalación real (ver PLAN-QA.md QA-6.2).
// El dominio es `.test` (RFC 2606, no resuelve) y NO `.e2e`: los formularios de los portales y
// cis/src/directivo/directivo.schemas.ts validan el email con `zod.string().email()`, cuyo regex
// exige un TLD alfabético (`[A-Z]{2,}`) — un TLD con dígito como `.e2e` se rechaza como "Email
// inválido". Keycloak sí acepta `.e2e`, pero el harness necesita que ambos lados lo acepten.
export const USUARIOS = {
  directivo: {
    email: 'directivo@duoc-uc.test',
    password: 'Directivo-e2e-2026',
    rol: 'directivo',
  },
  aft: {
    email: 'aft@duoc-uc.test',
    password: 'ProfesionalAft-e2e-2026',
    // El rol que cis/ efectivamente exige para el Profesional de AFT (ver
    // cis/src/directivo/directivo.constants.ts ADMINISTRADOR_PATRIMONIAL_ROLE), no "profesional-aft".
    rol: 'administrador-patrimonial',
  },
};

// Fixture patrimonial que crea SICSAFT_SEED_DEV=1
// (core/migrations/1755100000001_seed-dev-fixture-patrimonial.ts). Lo usan las specs para dar de
// alta activos contra un catálogo/área/ubicación que ya existen.
export const SEED_PATRIMONIAL = {
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  catalogoNotebookId: 'catalogo-notebook',
  catalogoProyectorId: 'catalogo-proyector',
  activoNotebookId: 'activo-notebook-001',
};
