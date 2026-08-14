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

// RF-05 (cierra el gap: el requisito original pedia "ABM completo") — payload de
// PATCH /ubicaciones/:id. Sin `sedeId`: mover una ubicacion a otra sede es un traslado, una
// operacion distinta y mas grande (misma logica que dejo el traslado de Activo sin controller
// HTTP en el Motor Patrimonial, DOC-008 — sin consumidor real, YAGNI). Todos los campos
// opcionales, el schema exige al menos uno.
export interface ActualizarUbicacionInput {
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}
