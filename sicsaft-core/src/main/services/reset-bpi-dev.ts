import { app } from "electron";
import { Client } from "pg";
import { POSTGRES_CONFIG } from "./postgres-service";
import { crearRespaldoBpi } from "./backup-service";
import { registrar } from "./logger";
import type { ResultadoVaciadoBpi } from "@shared/ipc-contract";

// HERRAMIENTA TEMPORAL DE PRUEBAS — pedida explícitamente (2026-09-09) para poder iterar sobre la
// ingesta contable sin reinstalar el cliente entre corridas.
//
// Va a contramano del invariante de Tomo III 4.10 ("ningún registro oficial de la BPI se borra con
// DELETE real; se da de baja con `estado`"). Ese invariante rige los flujos del producto; esto no
// es un flujo del producto sino un atajo de banco de pruebas, y por eso está construido para que
// no pueda sobrevivir a un descuido:
//
//   1. `app.isPackaged` — en el .exe instalado esta función se niega a correr, así que aunque nos
//      olvidemos de sacarla, ningún cliente puede vaciarse la base. El botón del renderer se
//      esconde con `import.meta.env.DEV`, que es la misma idea del otro lado: dos guardas
//      independientes, no una.
//   2. Respalda antes de tocar nada. Si el vaciado no era lo que se quería, el .sql queda en la
//      carpeta de respaldos.
//
// Para eliminarla: borrar este archivo, el handler `sicsaft-core:vaciarBpiDev`, las dos entradas
// del contrato IPC y el bloque del botón en ConsolaTecnica.tsx.

// La instalación NO se toca: `organizaciones`, `sedes`, `contratos` y `contrato_sedes` sobreviven,
// porque borrarlas obligaría a rehacer el wizard entero (y el marcador instalacion.json quedaría
// apuntando a una organización inexistente, que es exactamente el estado roto del que salimos
// hace un rato). Se vacía lo que produce la operación: activos, su estructura resuelta-o-creada
// por la ingesta, los lotes de importación, los inventarios y la traza de eventos.
const TABLAS_CORE = [
  "activos",
  "documentos_activo",
  "inventarios",
  "sesiones_inventario",
  "importacion_contable_lote_fila",
  "importacion_contable_lote",
  "auditoria",
  "eventos",
  "eventos_outbox",
  "areas",
  "responsables",
  "ubicaciones",
  "catalogo_activos",
] as const;

// Vaciar solo `core` deja mintiendo al tablero: el CIP mantiene sus propias proyecciones en
// una base aparte (RNF-01/RNF-05, bases separadas) y `cobertura_organizacion` seguía diciendo
// 66 activos registrados con la BPI ya en cero — el dashboard mostraba 66 bienes y una
// cobertura de 1/66. Son proyecciones derivadas de eventos, así que se reconstruyen solas: se
// pueden truncar sin perder nada que no esté en la BPI.
const TABLAS_CIP = [
  "activo_escaneado_alguna_vez",
  "activo_fuera_de_area",
  "activo_no_localizado",
  "categoria_activo_resumen",
  "cobertura_organizacion",
  "control_area",
  "estado_activo_resumen",
  "incidencia",
  "sync_estado",
  "veredicto_sesion",
] as const;

const BASES_A_VACIAR: { base: string; tablas: readonly string[] }[] = [
  { base: "core", tablas: TABLAS_CORE },
  { base: "cip", tablas: TABLAS_CIP },
];

async function vaciarBase(
  base: string,
  tablas: readonly string[],
): Promise<ResultadoVaciadoBpi["tablas"]> {
  const cliente = new Client({
    host: "127.0.0.1",
    port: POSTGRES_CONFIG.puerto,
    user: POSTGRES_CONFIG.usuarioAdmin,
    database: base,
  });
  await cliente.connect();
  try {
    const conteos: ResultadoVaciadoBpi["tablas"] = [];
    for (const tabla of tablas) {
      const res = await cliente.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM ${tabla}`,
      );
      conteos.push({
        tabla: `${base}.${tabla}`,
        filas: Number(res.rows[0]?.total ?? "0"),
      });
    }
    // Un solo TRUNCATE con todas: Postgres resuelve el orden entre ellas sin pelearse con las
    // claves foráneas. `CASCADE` alcanza a las tablas que APUNTAN a estas (hijas), nunca a las
    // que estas apuntan — por eso `organizaciones`/`sedes` no corren riesgo aunque
    // `ubicaciones.sede_id` las referencie.
    await cliente.query(
      `TRUNCATE TABLE ${tablas.join(", ")} RESTART IDENTITY CASCADE`,
    );
    return conteos;
  } finally {
    await cliente.end();
  }
}

export function bpiVaciableEnEsteEntorno(): boolean {
  return !app.isPackaged;
}

export async function vaciarBpiDev(): Promise<ResultadoVaciadoBpi> {
  if (!bpiVaciableEnEsteEntorno()) {
    throw new Error(
      "Vaciar la BPI solo está disponible en desarrollo, nunca en la app instalada.",
    );
  }

  const respaldo = await crearRespaldoBpi();
  registrar("reset-bpi", `Respaldo previo al vaciado: ${respaldo.nombre}`);

  const filasPorTabla: ResultadoVaciadoBpi["tablas"] = [];
  for (const { base, tablas } of BASES_A_VACIAR) {
    filasPorTabla.push(...(await vaciarBase(base, tablas)));
  }

  const total = filasPorTabla.reduce((acc, t) => acc + t.filas, 0);
  registrar(
    "reset-bpi",
    `BPI y proyecciones del CIP vaciadas: ${total} filas en ${filasPorTabla.length} tablas`,
  );
  return {
    respaldo: respaldo.nombre,
    filasBorradas: total,
    tablas: filasPorTabla,
  };
}
