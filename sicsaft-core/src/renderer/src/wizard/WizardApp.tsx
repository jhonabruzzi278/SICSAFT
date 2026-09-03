import { useEffect, useState } from "react";
import type {
  BootstrapClienteResultado,
  AltaDirectorResultado,
  EstadoIpLan,
} from "@shared/ipc-contract";
import { BrandBar } from "../components/BrandBar";
import { Button } from "../components/Button";
import { ConsolaTecnica } from "../components/ConsolaTecnica";
import { PasoDatosCliente } from "./PasoDatosCliente";
import { PasoDirector } from "./PasoDirector";
import { PasoProfesionalAft } from "./PasoProfesionalAft";
import { PasoIpCambio } from "./PasoIpCambio";
import { PasoListoConLogin } from "./PasoListoConLogin";

type PasoWizard =
  "datos-cliente" | "director" | "profesional-aft" | "ip-cambio" | "listo";

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
  // DOC-028 Fase C.1 -- si esta instalación ya existe pero la IP de LAN de la PC cambió, el wizard
  // muestra PasoIpCambio (reconfigura el client OIDC de la APP QR) antes de saltar al login.
  const [estadoIp, setEstadoIp] = useState<EstadoIpLan | null>(null);
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
      .then(async (existente) => {
        if (cancelado) return;
        if (existente) {
          setBootstrap({ organizacionId: existente.organizacionId });
          // DOC-028 Fase C.1 -- antes de saltar al login, chequear si la IP de LAN cambió desde
          // la instalación (el client OIDC de la APP QR quedaría apuntando a una IP muerta).
          const ip = await window.sicsaftCore.getEstadoIpLan();
          if (cancelado) return;
          setEstadoIp(ip);
          setPaso(ip.cambio ? "ip-cambio" : "listo");
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

  const pasoNumero: Record<PasoWizard, number | undefined> = {
    "datos-cliente": 1,
    director: 2,
    "profesional-aft": 3,
    "ip-cambio": undefined,
    listo: undefined,
  };

  function contenido() {
    if (verificandoInstalacion) {
      return (
        <EstadoCentrado>
          <span className="size-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm text-[var(--muted-foreground)]">
            Verificando instalación…
          </p>
        </EstadoCentrado>
      );
    }

    if (errorVerificacion) {
      return (
        <EstadoCentrado>
          <p className="max-w-sm text-sm text-[var(--destructive)]">
            No se pudo verificar la instalación: {errorVerificacion}
          </p>
          <div className="w-40">
            <Button
              type="button"
              variante="secundario"
              onClick={() => {
                setVerificandoInstalacion(true);
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        </EstadoCentrado>
      );
    }

    if (paso === "datos-cliente") {
      return (
        <PasoDatosCliente
          onListo={(resultado) => {
            setBootstrap(resultado);
            setPaso("director");
          }}
        />
      );
    }
    if (paso === "director" && bootstrap) {
      return (
        <PasoDirector
          organizacionId={bootstrap.organizacionId}
          onListo={(resultado) => {
            setDirector(resultado);
            setPaso("profesional-aft");
          }}
        />
      );
    }
    if (paso === "profesional-aft" && bootstrap && director) {
      return (
        <PasoProfesionalAft
          organizacionId={bootstrap.organizacionId}
          onListo={() => setPaso("listo")}
        />
      );
    }
    if (paso === "ip-cambio" && estadoIp) {
      return (
        <PasoIpCambio
          estado={estadoIp}
          onReconfigurado={() => setPaso("listo")}
        />
      );
    }
    if (paso === "listo") {
      return (
        <PasoListoConLogin onPortalCargado={() => setPortalCargado(true)} />
      );
    }
    return null;
  }

  return (
    <div
      className="flex h-full flex-col bg-background"
      style={
        portalCargado
          ? undefined
          : { background: "var(--background) var(--page-glow) no-repeat" }
      }
    >
      {!portalCargado && (
        <BrandBar subtitle={pasoLabel(paso, pasoNumero[paso])} />
      )}
      <main
        className={
          portalCargado
            ? "flex flex-1 overflow-hidden"
            : // `[&>*]:m-auto` centra el contenido cuando entra y lo alinea al inicio (sin
              // recortarlo) cuando desborda -- `items-center` recortaba la parte de arriba en
              // pantallas bajas / a pantalla completa (bug encontrado probando con cliente real).
              "flex flex-1 overflow-y-auto p-8 [&>*]:m-auto"
        }
      >
        {contenido()}
      </main>
      {/* Consola de diagnóstico, plegada -- disponible en cualquier paso del wizard por si el
          bootstrap (alta de cliente/Director/Profesional) falla con un error poco claro. Se
          oculta una vez que el portal real ocupa la ventana. */}
      {!portalCargado && (
        <footer className="flex shrink-0 justify-center border-t border-[var(--border)] px-4 pb-3">
          <ConsolaTecnica />
        </footer>
      )}
    </div>
  );
}

function pasoLabel(paso: PasoWizard, n: number | undefined): string {
  if (paso === "listo") return "Instalación completa";
  if (paso === "ip-cambio") return "Reconfiguración de red";
  return n ? `Instalación · paso ${n} de 3` : "Instalación";
}

function EstadoCentrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {children}
    </div>
  );
}
