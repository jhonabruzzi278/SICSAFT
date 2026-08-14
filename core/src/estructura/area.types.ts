// DOC-005 §2 — Area referencia Responsable/Ubicacion de vuelta (responsable_id,
// ubicacion_principal_id), ambas nullable, sin endpoint de asignacion en este incremento (ver
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
// §2 documenta el ciclo Area<->Responsable/Ubicacion como "sin ciclo estricto de creacion", así
// que un Area nace sin ellos y se asignan despues (fuera de alcance de este incremento).
export interface NuevaAreaInput {
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia?: string;
  centroCosto?: string;
}
