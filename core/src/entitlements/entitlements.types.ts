// Forma exacta que espera `AuthSessionResponse.organizaciones` en CIS
// (cis/src/qr-connector/qr-connector.types.ts) — ver
// base-patrimonial/DOC-004-modelo-contrato.md 6. No cambiar sin coordinar ambos lados, todavia
// no existe un paquete compartido de tipos entre CIS y CORE.
export interface Sede {
  id: string;
  nombre: string;
}

export interface Organizacion {
  id: string;
  nombre: string;
  sedes: Sede[];
}

export interface EntitlementsResponse {
  organizaciones: Organizacion[];
}
