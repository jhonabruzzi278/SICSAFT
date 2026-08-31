import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-029 RF-I (Pantalla 8) — el informe de control de área necesita el desglose "estado de los
// AFT declarado por el controlador" por cada escaneo (EN SERVICIO / EN MANTENIMIENTO / INACTIVO /
// BAJA). Hoy `estadoDeclarado`/`bajaSugerida` llegan en `POST /inventarios` (EscaneoInput,
// Fase 3.1) pero solo se aplican como efecto (transición de `Activo.estado` + evento) y no quedan
// asociados a la fila de escaneo — así que no hay forma de reconstruir qué declaró el controlador
// en ESA sesión (el estado del activo pudo cambiar después).
//
// Aditivo: dos columnas nullable en `inventarios` (la bitácora de escaneos, no un registro
// oficial de la Base Patrimonial — Tomo III 4.10 no aplica). Filas existentes quedan con NULL
// (sesiones anteriores a RF-I no traían el dato).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('inventarios', {
    estado_declarado: {
      type: 'text',
      check:
        "estado_declarado IS NULL OR estado_declarado IN ('activo', 'mantenimiento', 'inactivo')",
    },
    baja_sugerida_motivo: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('inventarios', ['estado_declarado', 'baja_sugerida_motivo']);
}
