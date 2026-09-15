import { describe, expect, it } from 'vitest';
import { generarPdfInformeControl } from './pdf-informe-control';

// Smoke test — arma un PDF con datos mínimos y con datos que fuerzan salto de página (muchas
// filas en una lista) para atrapar errores reales de la API de jsPDF (nombres de método, orden de
// argumentos) que un cambio futuro podría romper en silencio, ya que esto no se ve en ningún otro
// test del repo (no hay verificación visual automatizada de este módulo).
describe('generarPdfInformeControl', () => {
  const base = {
    areaNombre: 'Bodega Central',
    direccionNombre: 'Dirección Logística',
    departamentoNombre: 'Almacén General',
    fechaInicio: '2026-09-15T20:00:00.000Z',
    fechaCierre: '2026-09-15T21:00:00.000Z',
    operadorId: 'operador-1',
    veredicto: 'defectuoso' as const,
    veredictoEtiqueta: 'DEFECTUOSO',
    kpis: [
      { titulo: 'AFT del área', valor: '10', dato: 'Registrados en la BPI' },
    ],
    hallazgos: [
      { severidad: 'critico' as const, texto: '2 AFT no se escanearon' },
    ],
    categorias: [{ nombre: 'Mobiliario', cantidad: 5, porcentaje: '50.0' }],
    estadoDeclarado: [{ etiqueta: 'En servicio', cantidad: 8 }],
  };

  it('no lanza con datos mínimos (sin hallazgos ni listas)', () => {
    expect(() =>
      generarPdfInformeControl({
        ...base,
        hallazgos: [],
        categorias: [],
        listas: [{ titulo: 'AFT escaneados', filas: [] }],
      }),
    ).not.toThrow();
  });

  it('no lanza con listas largas que fuerzan salto de página', () => {
    const filas = Array.from({ length: 80 }, (_, i) => ({
      codigoQr: `QR-${i}`,
      nombre: `Activo ${i}`,
      extra: i % 2 === 0 ? 'pertenece a: Otra área' : undefined,
    }));
    expect(() =>
      generarPdfInformeControl({
        ...base,
        listas: [{ titulo: 'AFT escaneados', filas }],
      }),
    ).not.toThrow();
  });
});
