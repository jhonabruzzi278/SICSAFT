// Paso 3 del wizard — designar al Profesional de AFT. Reusa el mismo endpoint que ya existe
// (`POST /admin/organizaciones/:orgId/usuarios`, ver core/frontend/src/pages/
// GestionarProfesionalAftPage.tsx), pero ese endpoint vive en `cis/`, todavía no integrado a este
// scaffold (bloqueado por el spike de Redis, ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md y src/main/services/
// service-orchestrator.ts). Placeholder honesto: no simula una llamada que no existe.
export function PasoProfesionalAft({ onListo }: { onListo: () => void }) {
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <h2 className="text-lg font-medium text-foreground">
        Profesional de AFT
      </h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        Pendiente: este paso reusa la misma lógica que ya existe en{" "}
        <code className="text-[var(--faint-foreground)]">
          core/frontend/GestionarProfesionalAftPage.tsx
        </code>
        , pero necesita{" "}
        <code className="text-[var(--faint-foreground)]">cis/</code> corriendo
        embebido — bloqueado por el spike de Redis (ver{" "}
        <code>ARCHITECTURE.md</code>).
      </p>
      <button
        type="button"
        onClick={onListo}
        className="w-full rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 font-medium text-foreground"
      >
        Saltar por ahora
      </button>
    </div>
  );
}
