import { ActivoCatalogo, Organizacion } from './qr-connector.types';

// Datos semilla del mock — reemplazar por datos reales de Base Patrimonial cuando exista CORE.
// Ejemplo deliberado: DUOC UC con contrato vigente solo para la sede Melipilla (ver ADR-002,
// caso de negocio real: un cliente puede contratar una sede especifica, no toda la organizacion).
export const SEED_ORGANIZACIONES: readonly Organizacion[] = [
  {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
    sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
  },
];

export const SEED_CATALOGO: readonly ActivoCatalogo[] = [
  {
    codigoQr: 'QR-0001',
    nombre: 'Notebook Dell Latitude',
    organizacionId: 'duoc-uc',
    areaId: 'laboratorio-informatica',
    ubicacionId: 'melipilla',
    estado: 'activo',
  },
  {
    codigoQr: 'QR-0002',
    nombre: 'Proyector Epson',
    organizacionId: 'duoc-uc',
    areaId: 'sala-clases',
    ubicacionId: 'melipilla',
    estado: 'activo',
  },
];
