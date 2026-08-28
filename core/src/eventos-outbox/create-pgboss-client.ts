import type { PgBoss } from 'pg-boss';

// pg-boss es ESM-only ("type": "module" en su package.json) — core/ compila a CommonJS
// (moduleResolution nodenext, sin "type": "module" propio), así que un `import` estático no es
// válido en runtime (Node no puede `require()` un paquete ESM-only). El import dinámico es el
// mecanismo de interop soportado por Node para consumir un paquete ESM desde un módulo CJS, sin
// migrar todo `core/` a ESM.
export async function createPgBossClient(
  connectionString: string,
): Promise<PgBoss> {
  const { PgBoss } = await import('pg-boss');
  const boss = new PgBoss(connectionString);
  // Sin este listener, un error de conexión (Postgres caído) es un 'error' no manejado sobre el
  // EventEmitter y tumba el proceso — mismo criterio que ya aplicaba `create-redis-connection.ts`.
  boss.on('error', () => undefined);
  return boss;
}
