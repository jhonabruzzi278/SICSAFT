// DOC-021 3 (gap "documentación y fotografías", versión mínima) — `url` es un enlace externo que
// el operador ya subió a algún lado (sin bucket/OCR propio todavía, ver ROADMAP.md Fase 7 §
// "Idea futura sin diseñar"). No es parte de la BPI oficial — metadata operativa, no historial
// patrimonial (por eso admite DELETE real, a diferencia de `Activo`).
export type TipoDocumentoActivo = 'documento' | 'fotografia';

export interface DocumentoActivo {
  id: string;
  activoId: string;
  organizacionId: string;
  tipo: TipoDocumentoActivo;
  url: string;
  descripcion: string | null;
  creadoEn: string;
  creadoPor: string;
}

export interface NuevoDocumentoActivoInput {
  activoId: string;
  organizacionId: string;
  tipo: TipoDocumentoActivo;
  url: string;
  descripcion?: string;
  creadoPor: string;
}
