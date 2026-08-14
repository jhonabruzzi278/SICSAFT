// Datos fijos para los handlers de MSW (tests/aidlc, no producción). El catálogo se deriva de
// FULL_CATALOG (src/lib/catalog-data.ts) — esa distribución de productos ya está pensada para
// ejercitar las 6 categorías de escaneo alcanzables con la ubicación por defecto de los tests
// (org-001/area-001/loc-001, ver tests/helpers.js) y no tiene sentido duplicarla acá. `sedes[].nombre`
// no existe en catalog-data.ts (es un dato propio de CIS, GET /entitlements) — se define aparte.
import { FULL_CATALOG } from '@/lib/catalog-data';
import type { ConnectorAsset, OrganizacionSummary } from '@/lib/qr-connector';

export const MOCK_ORGANIZACIONES: OrganizacionSummary[] = [
  {
    id: 'org-001',
    nombre: 'Municipalidad Central',
    sedes: [
      { id: 'loc-001', nombre: 'Edificio Principal — Piso 1' },
      { id: 'loc-002', nombre: 'Edificio Principal — Piso 2' },
      { id: 'loc-003', nombre: 'Depósito Norte' },
    ],
  },
  {
    id: 'org-002',
    nombre: 'Hospital Regional',
    sedes: [
      { id: 'loc-004', nombre: 'Sala de Guardia' },
      { id: 'loc-005', nombre: 'Depósito Central' },
    ],
  },
];

export const MOCK_CATALOGO: ConnectorAsset[] = FULL_CATALOG.filter(
  (p): p is typeof p & { organizationId: string; areaId: string; locationId: string } =>
    Boolean(p.organizationId && p.areaId && p.locationId),
).map((p) => ({
  codigoQr: p.code,
  nombre: p.name,
  organizacionId: p.organizationId,
  areaId: p.areaId,
  ubicacionId: p.locationId,
}));

// P001 con una variante — ejercita la resolución de códigos "BASE-VARIANTE" (labels.ts,
// scan-resolve.ts) contra el catálogo real del Conector QR, no contra el catálogo local de
// CatalogPage (desconectado a propósito desde TASK-007, ver HANDOFF §3).
const p001 = MOCK_CATALOGO.find((a) => a.codigoQr === 'P001');
if (p001) p001.variants = [{ code: 'M', name: 'Mediana', stock: 0 }];
