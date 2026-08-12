// Datos semilla de organización/área/ubicación. No hay backend todavía (ver
// HANDOFF-APP-QR-SICSAFT.md sección 6) — esta jerarquía se resuelve local por
// ahora, igual que el catálogo demo en catalog-data.ts. No editable desde la
// UI en este alcance.
export interface OrgLocation {
  id: string;
  name: string;
}

export interface OrgArea {
  id: string;
  name: string;
  locations: OrgLocation[];
}

export interface Organization {
  id: string;
  name: string;
  areas: OrgArea[];
}

export const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-001',
    name: 'Municipalidad Central',
    areas: [
      {
        id: 'area-001',
        name: 'Administración',
        locations: [
          { id: 'loc-001', name: 'Edificio Principal — Piso 1' },
          { id: 'loc-002', name: 'Edificio Principal — Piso 2' },
        ],
      },
      {
        id: 'area-002',
        name: 'Obras Públicas',
        locations: [{ id: 'loc-003', name: 'Depósito Norte' }],
      },
    ],
  },
  {
    id: 'org-002',
    name: 'Hospital Regional',
    areas: [
      {
        id: 'area-003',
        name: 'Guardia',
        locations: [{ id: 'loc-004', name: 'Sala de Guardia' }],
      },
      {
        id: 'area-004',
        name: 'Farmacia',
        locations: [
          { id: 'loc-005', name: 'Depósito Central' },
          { id: 'loc-006', name: 'Mostrador' },
        ],
      },
    ],
  },
];
