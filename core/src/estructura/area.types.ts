// DOC-005 2 — Area referencia Responsable/Ubicacion de vuelta (responsable_id,
// ubicacion_principal_id), ambas nullable, asignables via PATCH /areas/:id (ver
// escritura-estructura.service.ts).
export interface Area {
  id: string;
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia: string | null;
  centroCosto: string | null;
  responsableId: string | null;
  ubicacionPrincipalId: string | null;
}

// RF-05 (Fase 5) — payload de POST /areas (alta). Sin responsableId/ubicacionPrincipalId: DOC-005
// 2 documenta el ciclo Area<->Responsable/Ubicacion como "sin ciclo estricto de creacion", así
// que un Area nace sin ellos y se asignan despues (fuera de alcance de este incremento).
export interface NuevaAreaInput {
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia?: string;
  centroCosto?: string;
}

// RF-05 (cierra el gap: el requisito original pedia "ABM completo") — payload de
// PATCH /areas/:id. Todos los campos opcionales, el schema (estructura.schemas.ts) exige al
// menos uno. `responsableId`/`ubicacionPrincipalId` cierran el ciclo que DOC-005 2 dejaba abierto
// al alta ("sin ciclo estricto de creacion" explica por que el alta no los exige, no por que la
// asignacion posterior no se pueda hacer nunca).
export interface ActualizarAreaInput {
  codigo?: string;
  nombre?: string;
  dependencia?: string;
  centroCosto?: string;
  responsableId?: string;
  ubicacionPrincipalId?: string;
}

// RNF-01 (cierra el gap) — GET /areas paginado, mismo criterio que CatalogoPagina.
export interface AreasPagina {
  areas: Area[];
  total: number;
}
