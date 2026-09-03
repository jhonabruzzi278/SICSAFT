import type { EstadoServicios, NombreServicio } from "@shared/ipc-contract";
import { BrandBar } from "../components/BrandBar";
import { ConsolaTecnica } from "../components/ConsolaTecnica";

const ETIQUETAS: Record<NombreServicio, string> = {
  postgres: "Base de datos",
  keycloak: "Identidad",
  cis: "Interoperabilidad (CIS)",
  core: "Orquestador (CORE)",
  cip: "Inteligencia patrimonial (CIP)",
};

const ORDEN: NombreServicio[] = ["postgres", "keycloak", "cis", "core", "cip"];

// CORE-RNF-02 (aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md): nunca una ventana en
// blanco mientras Postgres/Keycloak (la JVM, la más lenta) arrancan -- se muestra el progreso
// real servicio por servicio, no un spinner genérico sin información.
export function PasoIniciandoServicios({
  estado,
}: {
  estado: EstadoServicios;
}) {
  const hayError = Object.values(estado).some((s) => s.estado === "error");
  const listos = ORDEN.filter((n) => estado[n]?.estado === "listo").length;

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--background) var(--page-glow) no-repeat" }}
    >
      <BrandBar subtitle="Primer arranque" />
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-card p-8 shadow-elev-2">
          <h1 className="text-xl font-semibold text-foreground">
            {hayError ? "Hubo un problema al iniciar" : "Iniciando servicios"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            {hayError
              ? "Uno o más servicios no arrancaron. El detalle está en el log de la app."
              : `${listos} de ${ORDEN.length} listos. Postgres y la identidad (JVM) son los más lentos.`}
          </p>
          <ul className="mt-6 space-y-2">
            {ORDEN.map((nombre) => {
              const info = estado[nombre];
              return (
                <li
                  key={nombre}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm"
                >
                  <EstadoIcono estado={info?.estado} />
                  <span className="flex-1 text-card-foreground">
                    {ETIQUETAS[nombre]}
                  </span>
                  <EstadoTexto estado={info?.estado} detalle={info?.detalle} />
                </li>
              );
            })}
          </ul>
          {/* Log en vivo del arranque -- desplegado de una si algo ya falló, plegado si no. */}
          <ConsolaTecnica defaultAbierta={hayError} />
        </div>
      </div>
    </div>
  );
}

type Estado = EstadoServicios[string]["estado"] | undefined;

function EstadoIcono({ estado }: { estado: Estado }) {
  const base =
    "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold";
  if (estado === "listo") {
    return (
      <span className={`${base} bg-[var(--success)] text-background`}>✓</span>
    );
  }
  if (estado === "error") {
    return (
      <span className={`${base} bg-[var(--destructive)] text-background`}>
        ✕
      </span>
    );
  }
  if (estado === "iniciando") {
    return (
      <span
        className={`${base} border-2 border-[var(--primary)] border-t-transparent animate-spin`}
      />
    );
  }
  return <span className={`${base} border border-[var(--border-strong)]`} />;
}

function EstadoTexto({
  estado,
  detalle,
}: {
  estado: Estado;
  detalle?: string;
}) {
  if (!estado || estado === "detenido") {
    return <span className="text-[var(--faint-foreground)]">en cola</span>;
  }
  if (estado === "iniciando") {
    return <span className="text-[var(--primary)]">iniciando…</span>;
  }
  if (estado === "listo") {
    return <span className="text-[var(--success)]">listo</span>;
  }
  return (
    <span className="text-[var(--destructive)]" title={detalle}>
      error
    </span>
  );
}
