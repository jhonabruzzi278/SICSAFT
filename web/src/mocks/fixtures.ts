// Datos fijos para los handlers de MSW (solo e2e, ver src/main.tsx VITE_MOCK_API) — mismo
// criterio que app-qr-sicsaft/src/mocks/fixtures.ts (misma org de referencia, DUOC UC/Melipilla,
// que el seed de desarrollo real de core/migrations/..._seed-dev-fixture-patrimonial.ts).
import type { ActivoCatalogo, Organizacion } from '@/lib/cis-client';

export const MOCK_ORGANIZACIONES: Organizacion[] = [
  {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
    sedes: [{ id: 'sede-melipilla', nombre: 'Sede Melipilla' }],
  },
];

export const MOCK_CATALOGO: ActivoCatalogo[] = [
  {
    codigoQr: 'QR-NOTEBOOK-001',
    nombre: 'Notebook Dell Latitude',
    organizacionId: 'duoc-uc',
    areaId: 'area-informatica',
    ubicacionId: 'ubicacion-lab-1',
    estado: 'activo',
  },
];
