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
  it('genera alarma cuando el último control del área fue defectuoso', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'defectuoso', '2026-09-16T20:02:04.000Z'),
    ]);

    expect(alarmas).toHaveLength(1);
    expect(alarmas[0].areaId).toBe('area-1');
  });

  it('no genera alarma para veredictos exitoso ni aceptable', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'exitoso', '2026-09-16T10:00:00.000Z'),
      sesion('area-2', 'aceptable', '2026-09-16T11:00:00.000Z'),
    ]);

    expect(alarmas).toEqual([]);
  });

  it('baja la alarma cuando un control posterior de la misma área es excelente', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
      sesion('area-1', 'exitoso', '2026-09-17T09:00:00.000Z'),
    ]);

    expect(alarmas).toEqual([]);
  });

  it('mantiene la alarma si el control posterior vuelve a ser defectuoso', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'exitoso', '2026-09-15T10:00:00.000Z'),
      sesion('area-1', 'defectuoso', '2026-09-17T09:00:00.000Z'),
    ]);

    expect(alarmas).toHaveLength(1);
    expect(alarmas[0].fechaCierre).toBe('2026-09-17T09:00:00.000Z');
  });

  it('un control excelente en otra área no baja la alarma de la primera', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
      sesion('area-2', 'exitoso', '2026-09-17T09:00:00.000Z'),
    ]);

    expect(alarmas).toHaveLength(1);
    expect(alarmas[0].areaId).toBe('area-1');
  });

  it('un control aceptable posterior NO baja la alarma — solo el excelente', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'defectuoso', '2026-09-16T10:00:00.000Z'),
      sesion('area-1', 'aceptable', '2026-09-17T09:00:00.000Z'),
    ]);

    expect(alarmas).toEqual([]);
  });

  it('ordena las alarmas de la más reciente a la más antigua', () => {
    const alarmas = sesionesConAlarma([
      sesion('area-1', 'defectuoso', '2026-09-14T10:00:00.000Z'),
      sesion('area-2', 'defectuoso', '2026-09-17T10:00:00.000Z'),
    ]);

    expect(alarmas.map((a) => a.areaId)).toEqual(['area-2', 'area-1']);
  });

  it('sin sesiones no hay alarmas', () => {
    expect(sesionesConAlarma([])).toEqual([]);
  });
});
