// Paso 3 del wizard — designar al Profesional de AFT. Reusa el mismo endpoint que ya existe
// (`POST /admin/organizaciones/:orgId/usuarios`, ver core/frontend/src/pages/
// GestionarProfesionalAftPage.tsx), que vive en `cis/`. `cis/` ya corre embebido y arranca de
// verdad (ver `ServiceOrchestrator.iniciarCis`, llamado desde el paso 1 del wizard) -- lo que
// falta acá es cablear ESTE paso a esa llamada HTTP real (nuevo handler IPC, mismo patrón que
// `altaDirector`), no la infraestructura de por debajo. Placeholder honesto: no simula una llamada
// que no existe.
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
        , llamando al endpoint real de{" "}
        <code className="text-[var(--faint-foreground)]">cis/</code> (ya
        corriendo embebido) — falta agregar el handler IPC que la haga, ver{" "}
        <code>ipc/handlers.ts</code>.
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
