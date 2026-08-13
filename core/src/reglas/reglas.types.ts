// DOC-009 — vocabulario ya usado en cis/src/qr-connector/qr-connector.schemas.ts
// (scanResultadoSchema) y en el CHECK de inventarios.resultado (migracion
// 1755200000000_schema-orquestacion).
export type ScanResultado =
  | 'correcto'
  | 'otra_area'
  | 'otra_ubicacion'
  | 'no_registrado'
  | 'invalido'
  | 'duplicado'
  | 'ya_escaneado'
  | 'con_incidencia';
