export type EstadoResponsable = 'activo' | 'inactivo';

export interface Responsable {
  id: string;
  identificacion: string;
  nombre: string;
  cargo: string | null;
  areaId: string;
  correo: string | null;
  telefono: string | null;
  estado: EstadoResponsable;
}

// RF-05 (Fase 5) — payload de POST /responsables (alta). CORE decide `estado` ('activo') — nunca
// se confia desde el cliente. `organizacionId` no es columna de `responsables` — se usa solo para
// verificar que `areaId` pertenece a esa organizacion (defensa en profundidad, mismo criterio que
// UbicacionRepository).
export interface NuevoResponsableInput {
  organizacionId: string;
  identificacion: string;
  nombre: string;
  cargo?: string;
  areaId: string;
  correo?: string;
  telefono?: string;
}

// RNF-01 (cierra el gap) — GET /responsables paginado, mismo criterio que CatalogoPagina.
export interface ResponsablesPagina {
  responsables: Responsable[];
  total: number;
}
