// Datos fijos para los handlers de MSW (solo e2e, ver src/main.tsx VITE_MOCK_API) — mismo
// criterio que app-qr-sicsaft/src/mocks/fixtures.ts (misma org de referencia, DUOC UC/Melipilla,
// que el seed de desarrollo real de core/migrations/..._seed-dev-fixture-patrimonial.ts).
import type { Area, ActivoCatalogo, Organizacion } from '@/lib/cis-client';

export const MOCK_ORGANIZACIONES: Organizacion[] = [
  {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
    sedes: [{ id: 'sede-melipilla', nombre: 'Sede Melipilla' }],
  },
];

// DOC-029 RF-F — `dependencia` es la "dirección" que RF-B refleja de la columna DIRECCION del
// Excel; el módulo QR / Etiquetas agrupa por ahí.
export const MOCK_AREAS: Area[] = [
  {
    id: 'area-informatica',
    organizacionId: 'duoc-uc',
    codigo: 'INF',
    nombre: 'Informática',
    dependencia: 'Dirección de Administración y Finanzas',
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  },
  {
    id: 'area-biblioteca',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: 'Dirección Académica',
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  },
];

export const MOCK_CATALOGO: ActivoCatalogo[] = [
  {
    id: 'activo-notebook-001',
    codigoQr: 'QR-NOTEBOOK-001',
    nombre: 'Notebook Dell Latitude',
    organizacionId: 'duoc-uc',
    areaId: 'area-informatica',
    ubicacionId: 'ubicacion-lab-1',
    estado: 'activo',
  },
  {
    id: 'activo-proyector-002',
    codigoQr: 'QR-PROYECTOR-002',
    nombre: 'Proyector Epson PowerLite',
    organizacionId: 'duoc-uc',
    areaId: 'area-informatica',
    ubicacionId: 'ubicacion-lab-1',
    estado: 'activo',
  },
  {
    id: 'activo-escaner-003',
    codigoQr: 'QR-ESCANER-003',
    nombre: 'Escáner de libros Plustek',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-bib-1',
    estado: 'activo',
  },
];

// DOC-019 4 — solo para verificación manual en el navegador (VITE_MOCK_API), no consumido por
// el e2e de Playwright existente (login-alta.spec.js no toca /dashboard).
export const MOCK_SYNC = {
  actualizadoEn: '2026-08-18T10:00:00.000Z',
  alDia: true,
};
