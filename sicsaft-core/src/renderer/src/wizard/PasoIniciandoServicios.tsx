import type { EstadoServicios, NombreServicio } from "@shared/ipc-contract";

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

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-background px-8">
      <h1 className="text-2xl font-semibold text-foreground">SICSAFT CORE</h1>
      <p className="text-sm text-[var(--faint-foreground)]">
        {hayError
          ? "Hubo un problema iniciando algunos servicios."
          : "Iniciando servicios…"}
      </p>
      <ul className="w-full max-w-sm space-y-2">
        {ORDEN.map((nombre) => {
          const info = estado[nombre];
          return (
            <li
              key={nombre}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] bg-card px-4 py-2 text-sm"
            >
              <span className="text-card-foreground">{ETIQUETAS[nombre]}</span>
              <EstadoBadge estado={info?.estado} detalle={info?.detalle} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EstadoBadge({
  estado,
  detalle,
}: {
  estado: EstadoServicios[string]["estado"] | undefined;
  detalle?: string;
}) {
  if (!estado || estado === "detenido") {
    return <span className="text-[var(--faint-foreground)]">en cola</span>;
  }
  if (estado === "iniciando") {
    return <span className="text-[var(--primary)]">iniciando…</span>;
  }
  if (estado === "listo") {
    return <span className="text-[var(--success)]">✓ listo</span>;
  }
  return (
    <span className="text-[var(--destructive)]" title={detalle}>
      ✕ error
    </span>
  );
}
