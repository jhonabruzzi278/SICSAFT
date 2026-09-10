import { useEffect, useState } from "react";
import type { InfoPuestoAft } from "@shared/ipc-contract";
import { Button } from "./Button";

// DOC-028 Fase G -- el Profesional de AFT también trabaja desde su propia PC: esta (la "PC madre")
// le sirve el CCP en la red local. En su PC no se instala nada -- instalar el .exe ahí crearía una
// segunda BPI --: alcanza con abrir esta dirección en el navegador, o con el acceso directo que se
// guarda desde acá y se lleva a esa PC.
export function AccesoPuestoAft() {
  const [info, setInfo] = useState<InfoPuestoAft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    window.sicsaftCore
      .getInfoPuestoAft()
      .then((inf) => {
        if (!cancelado) setInfo(inf);
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function copiar(url: string): void {
    window.sicsaftCore
      .copiarAlPortapapeles(url)
      .then(() => setAviso("Dirección copiada."))
      .catch(() => setAviso("No se pudo copiar la dirección."));
  }

  function guardarAccesoDirecto(): void {
    window.sicsaftCore
      .guardarAccesoDirectoPuestoAft()
      .then((ruta) => {
        if (ruta) setAviso(`Acceso directo guardado en ${ruta}`);
      })
      .catch((err: unknown) => {
        setAviso(
          `No se pudo guardar el acceso directo: ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        );
      });
  }

  if (error) {
    return (
      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        No se pudo preparar el acceso para la PC del Profesional de AFT: {error}
      </p>
    );
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-sm flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">
        Puesto del Profesional de AFT — otra PC
      </p>
      <p className="text-center text-xs text-[var(--muted-foreground)]">
        En esa PC no se instala nada: se abre esta dirección en el navegador y
        se inicia sesión con las credenciales del Profesional de AFT.
      </p>

      {info ? (
        <p className="break-all text-center font-mono text-[12px] text-foreground">
          {info.url}
        </p>
      ) : (
        <div className="h-4 w-48 animate-pulse rounded bg-[var(--input)]" />
      )}

      {info && !info.enRed && (
        <p className="text-center text-[11px] text-[var(--destructive)]">
          Esta PC no está conectada a una red local: ningún otro equipo puede
          alcanzarla.
        </p>
      )}

      {info && (
        <div className="flex w-full flex-col gap-2">
          <Button
            type="button"
            variante="secundario"
            onClick={() => copiar(info.url)}
          >
            Copiar dirección
          </Button>
          <Button
            type="button"
            variante="secundario"
            onClick={guardarAccesoDirecto}
          >
            Guardar acceso directo…
          </Button>
        </div>
      )}

      {aviso && (
        <p className="break-all text-center text-[11px] text-[var(--faint-foreground)]">
          {aviso}
        </p>
      )}

      <p className="text-center text-[11px] leading-snug text-[var(--faint-foreground)]">
        La primera vez, el navegador de esa PC avisa &quot;certificado
        propio&quot;: Configuración avanzada → Continuar. Esta PC tiene que
        quedar encendida y en la misma red.
      </p>
    </div>
  );
}
