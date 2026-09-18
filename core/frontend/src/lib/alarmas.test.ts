import { describe, expect, it } from 'vitest';
import { sesionesConAlarma, type SesionVeredicto } from './alarmas';

function sesion(
  areaId: string,
  veredicto: string,
  fechaCierre: string,
): SesionVeredicto {
  return {
    sesionId: `${areaId}-${fechaCierre}`,
    areaId,
    veredicto,
    fechaCierre,
  };
}

describe('sesionesConAlarma', () => {
  it.each<[string, SesionVeredicto[], string[]]>([
    [
      'genera alarma cuando el último control del área fue defectuoso',
      [sesion('area-1', 'defectuoso', '2026-09-16T20:02:04.000Z')],
      ['area-1'],
    ],
    [
      'no genera alarma para veredictos exitoso ni aceptable',
      [
        sesion('area-1', 'exitoso', '2026-09-16T10:00:00.000Z'),
        sesion('area-2', 'aceptable', '2026-09-16T11:00:00.000Z'),
      ],
      [],
    ],
    [
      'baja la alarma cuando un control posterior de la misma área es excelente',
      [
        sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
        sesion('area-1', 'exitoso', '2026-09-17T09:00:00.000Z'),
      ],
      [],
    ],
    [
      'mantiene la alarma si el control posterior vuelve a ser defectuoso',
      [
        sesion('area-1', 'exitoso', '2026-09-15T10:00:00.000Z'),
        sesion('area-1', 'defectuoso', '2026-09-17T09:00:00.000Z'),
      ],
      ['area-1'],
    ],
    [
      'un control excelente en otra área no baja la alarma de la primera',
      [
        sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
        sesion('area-2', 'exitoso', '2026-09-17T09:00:00.000Z'),
      ],
      ['area-1'],
    ],
    [
      'un control aceptable posterior NO baja la alarma — solo el excelente',
      [
        sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
        sesion('area-1', 'aceptable', '2026-09-17T09:00:00.000Z'),
      ],
      [],
    ],
    [
      'ordena las alarmas de la más reciente a la más antigua',
      [
        sesion('area-1', 'defectuoso', '2026-09-14T10:00:00.000Z'),
        sesion('area-2', 'defectuoso', '2026-09-17T10:00:00.000Z'),
      ],
      ['area-2', 'area-1'],
    ],
    ['sin sesiones no hay alarmas', [], []],
  ])('%s', (_descripcion, sesiones, areasEsperadas) => {
    const alarmas = sesionesConAlarma(sesiones);
    expect(alarmas.map((a) => a.areaId)).toEqual(areasEsperadas);
  });

  it('conserva la fecha de cierre del control que generó la alarma', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'exitoso', '2026-09-15T10:00:00.000Z'),
      sesion('area-1', 'defectuoso', '2026-09-17T09:00:00.000Z'),
    ]);

    expect(alarmas[0].fechaCierre).toBe('2026-09-17T09:00:00.000Z');
  });
});
