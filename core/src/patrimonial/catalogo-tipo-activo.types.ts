// DOC-021 4 (gap "familias/categorías") — tipos sobre `catalogo_activos` (migracion
// 1755100000000), la tabla de tipos/familias de Activo — no confundir con `ActivoCatalogo`
// (activo.types.ts), que es el listado de activos que consume APP QR via `GET /catalogo`.
export interface CatalogoTipoActivo {
  id: string;
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
  fabricante: string | null;
  vidaUtilMeses: number | null;
  criticidad: 'baja' | 'media' | 'alta';
  tecnologiaIdentificacion: 'qr' | 'rfid' | 'qr_rfid';
}

export interface NuevoCatalogoTipoActivoInput {
  tipo: string;
  familia: string;
  subfamilia?: string;
  marca?: string;
  modelo?: string;
  fabricante?: string;
  vidaUtilMeses?: number;
  criticidad: 'baja' | 'media' | 'alta';
  tecnologiaIdentificacion: 'qr' | 'rfid' | 'qr_rfid';
}
