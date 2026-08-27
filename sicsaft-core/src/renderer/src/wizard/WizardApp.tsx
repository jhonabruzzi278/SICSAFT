import { useState } from "react";
import type {
  BootstrapClienteResultado,
  AltaDirectorResultado,
} from "@shared/ipc-contract";
import { PasoDatosCliente } from "./PasoDatosCliente";
import { PasoDirector } from "./PasoDirector";
import { PasoProfesionalAft } from "./PasoProfesionalAft";

type PasoWizard = "datos-cliente" | "director" | "profesional-aft" | "listo";

// Máquina de estados simple del wizard de primer arranque (ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque — wizard nativo") --
// sin router todavía, un wizard lineal no lo necesita. Cada paso reusa la lógica ya construida
// (Bootstrap-Keycloak.psm1 portado en keycloak-bootstrap.ts, KeycloakAdminService.crearUsuarioHuman
// pendiente de portar -- ver ipc/handlers.ts) vía IPC, nunca directo.
export function WizardApp() {
  const [paso, setPaso] = useState<PasoWizard>("datos-cliente");
  const [bootstrap, setBootstrap] = useState<BootstrapClienteResultado | null>(
    null,
  );
  const [director, setDirector] = useState<AltaDirectorResultado | null>(null);

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-[var(--border)] px-8 py-4">
        <h1 className="text-lg font-semibold text-foreground">
          SICSAFT CORE — Instalación
        </h1>
      </header>
      <main className="flex flex-1 items-center justify-center px-8">
        {paso === "datos-cliente" && (
          <PasoDatosCliente
            onListo={(resultado) => {
              setBootstrap(resultado);
              setPaso("director");
            }}
          />
        )}
        {paso === "director" && bootstrap && (
          <PasoDirector
            organizacionId={bootstrap.organizacionId}
            onListo={(resultado) => {
              setDirector(resultado);
              setPaso("profesional-aft");
            }}
          />
        )}
        {paso === "profesional-aft" && director && (
          <PasoProfesionalAft onListo={() => setPaso("listo")} />
        )}
        {paso === "listo" && (
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Instalación completa
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              El Director y el Profesional de AFT ya pueden iniciar sesión.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
