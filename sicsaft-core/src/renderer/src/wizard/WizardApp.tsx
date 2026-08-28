import { useEffect, useState } from "react";
import type {
  BootstrapClienteResultado,
  AltaDirectorResultado,
} from "@shared/ipc-contract";
import { PasoDatosCliente } from "./PasoDatosCliente";
import { PasoDirector } from "./PasoDirector";
import { PasoProfesionalAft } from "./PasoProfesionalAft";
import { PasoListoConLogin } from "./PasoListoConLogin";

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
  // Ver PasoListoConLogin.tsx -- una vez que el portal real (dashboard completo) está cargado, el
  // header y el padding centrado de acá ya no aplican, el portal pasa a ocupar toda la ventana.
  const [portalCargado, setPortalCargado] = useState(false);
  // Un cliente por instalación (ver keycloak-bootstrap.ts bootstrapPrimeraInstalacion) -- si esta
  // instalación ya corrió el wizard antes (instalacion-marker.ts en el proceso principal), saltar
  // directo al login en vez de reintentar el paso 1 y romper con 409 contra un realm que ya
  // existe. Bug real encontrado 2026-08-28 al relanzar la app con postgres-data persistido.
  const [verificandoInstalacion, setVerificandoInstalacion] = useState(true);
  // Bug real encontrado 2026-08-28: la promesa de getInstalacionExistente() no tenía .catch() --
  // un fallo real (ej. Keycloak devolviendo 500 justo después de arrancar, ver el reintento
  // agregado en keycloak-bootstrap.ts obtenerTokenAdmin) quedaba como una excepción no manejada en
  // la consola y `verificandoInstalacion` nunca pasaba a false -- el wizard se quedaba trabado en
  // "Verificando instalación…" para siempre, sin ningún mensaje ni forma de reintentar.
  const [errorVerificacion, setErrorVerificacion] = useState<string | null>(
    null,
  );
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setErrorVerificacion(null);
    window.sicsaftCore
      .getInstalacionExistente()
      .then((existente) => {
        if (cancelado) return;
        if (existente) {
          setBootstrap({ organizacionId: existente.organizacionId });
          setPaso("listo");
        }
        setVerificandoInstalacion(false);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setErrorVerificacion(
          err instanceof Error ? err.message : "Error desconocido",
        );
        setVerificandoInstalacion(false);
      });
    return () => {
      cancelado = true;
    };
  }, [intento]);

  if (verificandoInstalacion) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-[var(--muted-foreground)]">
          Verificando instalación…
        </p>
      </div>
    );
  }

  if (errorVerificacion) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-sm text-[var(--destructive)]">
          No se pudo verificar la instalación: {errorVerificacion}
        </p>
        <button
          type="button"
          onClick={() => {
            setVerificandoInstalacion(true);
            setIntento((n) => n + 1);
          }}
          className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {!portalCargado && (
        <header className="border-b border-[var(--border)] px-8 py-4">
          <h1 className="text-lg font-semibold text-foreground">
            SICSAFT CORE — Instalación
          </h1>
        </header>
      )}
      <main
        className={
          portalCargado
            ? "flex flex-1 overflow-hidden"
            : "flex flex-1 items-center justify-center px-8"
        }
      >
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
          <PasoListoConLogin onPortalCargado={() => setPortalCargado(true)} />
        )}
      </main>
    </div>
  );
}
