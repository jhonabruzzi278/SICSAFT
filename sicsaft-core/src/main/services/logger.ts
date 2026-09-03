import { app } from "electron";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type WriteStream,
} from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";

// Log unificado de la app de escritorio: el proceso principal (console.*), el orquestador
// (cambios de estado) y la salida cruda de cada servicio embebido (Postgres, Keycloak, CIS, CORE,
// CIP, watcher de ingesta) van todos acá. Dos consumidores:
//  1) un archivo en %APPDATA%/sicsaft-core/logs/ (rota por día, se borra lo de más de 7 días) —
//     para poder pedirlo después por mail/soporte.
//  2) un buffer en memoria + un evento por línea — la "Consola técnica" del renderer los muestra
//     en vivo (ConsolaTecnica.tsx), así un install que falla se diagnostica en pantalla sin abrir
//     una terminal.
//
// Nunca escribe secretos: `redactar()` tapa passwords, tokens y `client_secret` antes de guardar
// o mostrar (si no, el .log en la PC del cliente tendría la clave de admin de Keycloak en claro).

const MAX_LINEAS_BUFFER = 3000;
const DIAS_RETENCION = 7;

const emisor = new EventEmitter();
const buffer: string[] = [];
let stream: WriteStream | null = null;

export function rutaCarpetaLog(): string {
  return join(app.getPath("userData"), "logs");
}

// Patrones de secreto conocidos en la salida de los servicios / el env que se les pasa. Se
// aplica sobre cada línea antes de tocar disco o el buffer.
const REDACCIONES: ReadonlyArray<readonly [RegExp, string]> = [
  // clave: valor  /  clave=valor  (password, secret, token, storepass, keypass, ...)
  [
    /((?:password|passwd|pwd|secret|client[_-]?secret|token|storepass|keypass|store[_-]?password|key[_-]?password)\s*["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi,
    "$1***",
  ],
  // Authorization: Bearer / Basic <valor>
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._\-+/=]{6,}/g, "$1 ***"],
  // postgres://usuario:clave@host  ->  postgres://usuario:***@host
  [/\b(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s]+(@)/gi, "$1***$2"],
  // env vars puntuales del stack embebido
  [
    /\b(KEYCLOAK_ADMIN_PASSWORD|KEYCLOAK_ADMIN_CLIENT_SECRET|CORE_DB_PASSWORD|CIP_DB_PASSWORD|CORE_SERVICE_TOKEN|CIP_SERVICE_TOKEN|EVENTOS_OUTBOX_DATABASE_URL)\s*=\s*\S+/g,
    "$1=***",
  ],
];

export function redactar(texto: string): string {
  let salida = texto;
  for (const [re, reemplazo] of REDACCIONES) {
    salida = salida.replace(re, reemplazo);
  }
  return salida;
}

function nombreArchivoDeHoy(fecha: Date): string {
  return `sicsaft-core-${fecha.toISOString().slice(0, 10)}.log`;
}

// Borra los .log de más de DIAS_RETENCION días. Best-effort: un archivo bloqueado o un error de
// permisos no debe frenar el arranque.
function purgarViejos(dir: string, ahora: Date): void {
  const limite = ahora.getTime() - DIAS_RETENCION * 24 * 60 * 60 * 1000;
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return;
  }
  for (const nombre of entradas) {
    if (!nombre.startsWith("sicsaft-core-") || !nombre.endsWith(".log"))
      continue;
    const ruta = join(dir, nombre);
    try {
      if (statSync(ruta).mtimeMs < limite) unlinkSync(ruta);
    } catch {
      // ignorar
    }
  }
}

// Abre (o reabre, si ya había uno) el archivo de log del día. `index.ts` lo llama una vez al
// arrancar; reabrir es inofensivo (cierra el stream anterior primero) y sirve para el rollover
// de fecha si la app queda días abierta.
export function iniciarLogger(ahora: Date = new Date()): void {
  cerrarLogger();
  const dir = rutaCarpetaLog();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  purgarViejos(dir, ahora);
  const archivo = join(dir, nombreArchivoDeHoy(ahora));
  // Crea el archivo de forma síncrona: `createWriteStream` abre el fd en la próxima vuelta del
  // event loop, y queremos que "Abrir carpeta de logs" tenga algo que mostrar desde el arranque.
  writeFileSync(archivo, "", { flag: "a" });
  const s = createWriteStream(archivo, { flags: "a" });
  // Un error de escritura (disco lleno, carpeta borrada) no debe tumbar la app: se descarta el
  // stream y el log sigue vivo en memoria (buffer + evento) para la Consola técnica.
  s.on("error", () => {
    if (stream === s) stream = null;
  });
  stream = s;
  registrar("app", `--- sesión iniciada: ${ahora.toISOString()} ---`);
}

// Cierra el archivo de log (al salir de la app, o entre tests).
export function cerrarLogger(): void {
  if (!stream) return;
  const s = stream;
  stream = null;
  s.end();
}

// Registra una entrada. `texto` puede traer varias líneas (chunk de stdout de un servicio) —
// se parte y cada línea no vacía se guarda con su prefijo.
export function registrar(origen: string, texto: string): void {
  const marca = new Date().toISOString();
  for (const cruda of String(texto).split(/\r?\n/)) {
    const linea = cruda.trimEnd();
    if (!linea) continue;
    const entrada = `${marca} [${origen}] ${redactar(linea)}`;
    buffer.push(entrada);
    if (buffer.length > MAX_LINEAS_BUFFER) buffer.shift();
    stream?.write(entrada + "\n");
    emisor.emit("linea", entrada);
  }
}

// Snapshot de lo acumulado — el renderer lo pide al abrir la Consola técnica.
export function obtenerBuffer(): string[] {
  return [...buffer];
}

// Suscripción a las líneas nuevas — el renderer la usa para el stream en vivo.
export function alRegistrar(callback: (linea: string) => void): () => void {
  emisor.on("linea", callback);
  return () => emisor.off("linea", callback);
}
