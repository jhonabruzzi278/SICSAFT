export interface Ubicacion {
  id: string;
  sedeId: string;
  edificio: string | null;
  piso: string | null;
  areaId: string | null;
  oficina: string | null;
  dependencia: string | null;
}

// RF-05 (Fase 5) — payload de POST /ubicaciones (alta). `organizacionId` no es columna de
// `ubicaciones` — se usa solo para verificar que `sedeId` (y `areaId`, si viene) pertenecen a esa
// organizacion antes de insertar (defensa en profundidad, ver ubicacion.repository.ts).
export interface NuevaUbicacionInput {
  organizacionId: string;
  sedeId: string;
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}
