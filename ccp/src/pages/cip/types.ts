// Tipos y contratos de dominio para el Centro de Inteligencia Patrimonial (CIP)

export type SeccionCip =
  | 'resumen'
  | 'activos'
  | 'inventarios'
  | 'mantenimientos'
  | 'traslados'
  | 'reportes'
  | 'alertas'
  | 'ubicaciones'
  | 'usuarios'
  | 'config';

export interface ActivoFilaAft {
  id: string;
  codigoQr: string;
  codigoAft: string;
  nombre: string;
  familia: string;
  subfamilia: string;
  categoria: string;
  marca: string;
  modelo: string;
  serie: string;
  estado: 'En Servicio' | 'En Mantenimiento' | 'Traslado' | 'Baja' | 'Inactivo';
  direccionNombre: string;
  areaNombre: string;
  sedeUbicacion: string;
  responsableNombre: string;
  rutResponsable: string;
  valorAdquisicion: number;
  valorLibro: number;
  depreciacionAcumulada: number;
  vidaUtilMeses: number;
  criticidad: 'Baja' | 'Media' | 'Alta';
  tecnologia: 'QR Matriz 2D' | 'RFID' | 'Dual QR/RFID';
  fechaAlta: string;
  ultimoEscaneo: string;
  veredictoEscaneo: 'Correcto' | 'Pendiente' | 'Fuera de Área' | 'Observado';
  descripcion: string;
}

export interface CategoriaSegmento {
  nombre: string;
  cantidad: number;
  porcentaje: string;
  color: string;
  inicio?: number;
  fin?: number;
}

export interface EstadoBarraData {
  estado: string;
  cantidad: number;
  color: string;
}

export interface CipKpiResumen {
  totalActivos: number;
  activosServicio: number;
  activosMantenimiento: number;
  activosBaja: number;
  valorTotalBruto: number;
  valorTotalNeto: number;
  porcentajeOperatividad: number;
}
