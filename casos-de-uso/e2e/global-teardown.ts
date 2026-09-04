import { down } from './scripts/stack.mjs';

export default async function globalTeardown(): Promise<void> {
  if (process.env.KEEP_STACK === '1') {
    console.log(
      '\n[casos-de-uso] KEEP_STACK=1 — dejo el stack levantado. `npm run stack:down` para bajarlo,\n' +
        '               `npm run stack:logs` para ver logs.\n',
    );
    return;
  }
  console.log('\n[casos-de-uso] Bajando stack (docker compose down -v)…');
  down();
}
