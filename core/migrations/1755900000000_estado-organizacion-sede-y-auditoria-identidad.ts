import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-024 — cierra el pedido explicito del usuario de tener CRUD completo (editar/dar de baja, no
// solo crear) sin depender de la Consola de Zitadel, con auditoria unificada. Aditivo en las 3
// tablas: ninguna fila existente deja de ser valida.
//
// `estado` en organizaciones/sedes: mismo patron ya usado por `activos.estado`
// (1755400000000_estados-mantenimiento-inactivo.ts) y `responsables.estado` — bidireccional,
// nunca DELETE (Tomo III 4.10 prohibe borrar registros oficiales de la Base Patrimonial, ver
// DOC-024 1). Sin cascada a proposito: desactivar una organizacion/sede no cambia el estado de
// ningun contrato existente (DOC-024 1).
//
// `categoria`/`organizacion_id` en auditoria: DOC-024 3 — permite que las operaciones de
// identidad de Zitadel (asignar/quitar rol, hoy fuera del Motor de Auditoria de Tomo IV por
// diseno de DOC-021/022) se registren en la MISMA tabla que ya llena
// OrquestadorService.ejecutarOperacionOficial, en vez de un log paralelo. `categoria` default
// 'patrimonial' preserva el significado de cada fila ya existente. `organizacion_id` nullable:
// no todo evento tiene una organizacion puntual (ej. el propio alta de Organizacion).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('organizaciones', {
    estado: {
      type: 'text',
      notNull: true,
      default: 'activo',
      check: "estado IN ('activo', 'inactivo')",
    },
  });

  pgm.addColumn('sedes', {
    estado: {
      type: 'text',
      notNull: true,
      default: 'activo',
      check: "estado IN ('activo', 'inactivo')",
    },
  });

  pgm.addColumns('auditoria', {
    categoria: {
      type: 'text',
      notNull: true,
      default: 'patrimonial',
      check: "categoria IN ('patrimonial', 'identidad')",
    },
    organizacion_id: { type: 'text', references: 'organizaciones' },
  });
  pgm.createIndex('auditoria', 'categoria');
  pgm.createIndex('auditoria', 'organizacion_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('auditoria', 'organizacion_id');
  pgm.dropIndex('auditoria', 'categoria');
  pgm.dropColumns('auditoria', ['organizacion_id', 'categoria']);
  pgm.dropColumns('sedes', ['estado']);
  pgm.dropColumns('organizaciones', ['estado']);
}
