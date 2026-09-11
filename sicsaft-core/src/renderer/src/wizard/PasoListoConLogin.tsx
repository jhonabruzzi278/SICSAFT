import { useEffect, useRef, useState } from "react";
import { QrAppQr } from "../components/QrAppQr";
import { CarpetaIngesta } from "../components/CarpetaIngesta";
import { AccesoPuestoAft } from "../components/AccesoPuestoAft";

// CORE-RF-04 (alcance corregido 2026-08-28) -- el "cuadrado" acá es un placeholder vacío en el
// DOM: la WebContentsView real vive fuera del DOM, el proceso principal la dibuja encima de este
// rectángulo (ver portal-login-service.ts). Ese es también el motivo de reenviar bounds en cada
// resize -- si la ventana cambia de tamaño y este componente no avisa, la vista embebida queda
// desalineada del placeholder que el usuario ve.
//
// Dos tamaños distintos a propósito (bug de layout real encontrado 2026-08-28, "no se ve bien,
// agrande la pantalla"): antes del login, un cuadro chico centrado (pedido explícito del usuario,
// "un cuadrado con un login más chico") -- muestra la pantalla real de Keycloak, que ya es chica
// de por sí. Una vez que el login termina y el portal real está cargado (dashboard completo de
// core/frontend o ccp), ese mismo cuadro chico se queda corto -- se expande a ocupar toda la
// ventana, como cualquier app real. `portalCargado` distingue los dos momentos: pasa a true recién
// cuando mostrarPortalEmbebido() resuelve (login + portal ya cargado del todo, ver
// portal-login-service.ts mostrarLoginYPortal), no antes.
// `onPortalCargadoChange` avisa en las DOS direcciones a propósito. Con el callback anterior
// (`onPortalCargado`, sin argumento, solo al cargar) WizardApp ponía su propio portalCargado en
// true y no había forma de volverlo a false: al tocar "Cambiar de usuario" este componente
// volvía a su layout chico pero el wizard seguía con el chrome de portal cargado -- sin
// BrandBar, sin padding, sin centrado y con `overflow-hidden`, que además aplastaba el cuadro
// de login de 420px a una línea. Bug real reportado 2026-09-08 ("no se ve bien").
interface PasoListoConLoginProps {
  onPortalCargadoChange?: (cargado: boolean) => void;
}

export function PasoListoConLogin({
  onPortalCargadoChange,
}: PasoListoConLoginProps) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalCargado, setPortalCargado] = useState(false);
  // "Cambiar de usuario" (pedido explícito del usuario 2026-08-28) dispara un nuevo intento de
  // login -- se suma 1 cada vez que se pide uno. 0 = el mount inicial (deja que el SSO entre
  // solo, cómodo para el uso normal); >0 = pedido manual, fuerza el formulario (prompt=login, ver
  // portal-login-service.ts) para poder loguearse con otra cuenta sin cerrar la app.
  const [intentoLogin, setIntentoLogin] = useState(0);
  // Guardia contra el doble-montaje de React StrictMode (main.tsx) en dev, generalizada más allá
  // del mount inicial: mostrarPortalEmbebido arranca un flujo OIDC completo (state/PKCE + una
  // WebContentsView nativa) -- no es idempotente como un simple efecto de suscripción, así que
  // StrictMode montando el efecto dos veces (mount→cleanup→mount) disparaba dos flujos
  // concurrentes con dos `state` distintos y el redirect final terminaba comparado contra el
  // `state` de la llamada equivocada -- bug real encontrado 2026-08-28, ver también el cierre real
  // de la vista vieja en portal-login-service.ts cerrar(). Guarda el último intentoLogin que
  // efectivamente disparó una llamada -- si el efecto se re-ejecuta con el MISMO valor (StrictMode
  // re-montando), no dispara de nuevo; si intentoLogin cambió de verdad (mount inicial vs. un
  // click en "Cambiar de usuario"), sí.
  const ultimoIntentoDisparado = useRef(-1);
  // Ref en vez de dependencia directa del efecto -- si onPortalCargado estuviera en el array de
  // dependencias, cada nueva identidad de esa función (WizardApp la pasa como arrow inline, una
  // instancia nueva por render) dispararía el efecto de nuevo y volvería a llamar
  // mostrarPortalEmbebido -- el mismo bug de doble-invocación de arriba, por otra vía. El ref
  // siempre apunta a la versión más reciente sin necesidad de re-ejecutar el efecto.
  const onPortalCargadoRef = useRef(onPortalCargadoChange);
  onPortalCargadoRef.current = onPortalCargadoChange;

  // Único camino para cambiar `portalCargado`: mantiene el estado local y el del wizard en el
  // mismo valor por construcción, en vez de depender de que cada punto de cambio se acuerde de
  // avisar hacia arriba.
  function actualizarPortalCargado(cargado: boolean): void {
    setPortalCargado(cargado);
    onPortalCargadoRef.current?.(cargado);
  }

  useEffect(() => {
    const elemento = placeholderRef.current;
    if (!elemento) return;

    function enviarBoundsResize(): void {
      if (!elemento) return;
      const rect = elemento.getBoundingClientRect();
      window.sicsaftCore.actualizarBoundsPortalEmbebido({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }

    if (ultimoIntentoDisparado.current !== intentoLogin) {
      ultimoIntentoDisparado.current = intentoLogin;
      const rect = elemento.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      setError(null);
      window.sicsaftCore
        .mostrarPortalEmbebido(bounds, intentoLogin > 0)
        .then(() => {
          actualizarPortalCargado(true);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Error desconocido");
        });
    }

    // ResizeObserver cubre los cambios de TAMAÑO del placeholder. No cubre que el placeholder se
    // TRASLADE sin cambiar de tamaño -- pasa a pantalla completa / en ventanas bajas, cuando el
    // <main> del wizard es overflow-y-auto y el usuario scrollea, o cuando un reflow de arriba lo
    // empuja. Sin re-enviar bounds en esos casos, la WebContentsView nativa (que el proceso
    // principal dibuja según el último bounds) queda desalineada del cuadro que el usuario ve.
    // Bug encontrado probando con cliente real 2026-08-31.
    const observer = new ResizeObserver(enviarBoundsResize);
    observer.observe(elemento);
    window.addEventListener("resize", enviarBoundsResize);
    window.addEventListener("scroll", enviarBoundsResize, true);
    const reflowTardio1 = window.setTimeout(enviarBoundsResize, 120);
    const reflowTardio2 = window.setTimeout(enviarBoundsResize, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", enviarBoundsResize);
      window.removeEventListener("scroll", enviarBoundsResize, true);
      window.clearTimeout(reflowTardio1);
      window.clearTimeout(reflowTardio2);
    };
  }, [intentoLogin]);

  // Achica de vuelta al cuadro chico (dispara el efecto de arriba, que va a mandar el bounds
  // nuevo -- más chico -- de esa layout) y pide un login nuevo forzado. Dos pasos separados a
  // propósito: portalCargado tiene que volver a false ANTES de leer el bounds nuevo, así que no
  // alcanza con solo incrementar intentoLogin -- el efecto necesita ver el layout ya actualizado.
  function cambiarUsuario(): void {
    actualizarPortalCargado(false);
    setIntentoLogin((n) => n + 1);
  }

  // Importante: el <div ref={placeholderRef}> tiene que ser el MISMO nodo del DOM en las dos
  // variantes (antes/después de portalCargado) -- si en vez de esto se devolviera un árbol JSX
  // distinto por rama (ej. un solo <div> full-bleed cuando portalCargado), React lo trata como un
  // elemento nuevo (mismo tipo pero posición/estructura distinta), lo desmonta y crea uno nuevo.
  // El ResizeObserver de más arriba quedaría observando el nodo viejo (ya fuera del DOM) y nunca
  // más dispararía -- el placeholder se vería grande en el DOM pero el WebContentsView real
  // (dibujado por el proceso principal según el último bounds recibido) se quedaría con el tamaño
  // chico de antes. Bug real encontrado 2026-08-28 ("agrandé la pantalla y no se ve bien"). Por
  // eso acá se cambia solo la clase, nunca la forma del árbol alrededor del nodo con el ref.
  //
  // La franja de "Cambiar de usuario" está SIEMPRE presente (antes y después de portalCargado),
  // nunca condicional -- bug real encontrado 2026-08-28: un botón HTML normal puesto solo debajo
  // del cuadro de login desaparece para siempre en cuanto portalCargado pasa a true (esa rama del
  // layout ya no lo renderiza), y aunque se lo pusiera encima de la zona del placeholder, un
  // WebContentsView nativo se dibuja fuera del árbol de compositing del DOM -- tapa cualquier
  // elemento HTML de esta página que esté "debajo" de sus bounds, no hay z-index que gane contra
  // eso. La única franja que un botón de este documento puede ocupar de forma confiable es una
  // que quede FUERA del rectángulo que se le manda a mostrarPortalEmbebido/
  // actualizarBoundsPortalEmbebido -- por eso vive en su propio div, antes del placeholder, en las
  // dos variantes de layout.
  return (
    <div
      className={
        portalCargado
          ? "flex h-full w-full flex-col"
          : "flex w-full max-w-xl flex-col items-center gap-5 text-center"
      }
    >
      <div className={portalCargado ? "hidden" : undefined}>
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--success)]/15 text-2xl text-[var(--success)]">
          ✓
        </div>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          Instalación completa
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
          Iniciá sesión acá abajo (Director / Profesional de AFT). El QR para el
          teléfono, el acceso para la PC del Profesional de AFT y la carpeta de
          ingesta quedan al pie.
        </p>
      </div>
      {error && !portalCargado && (
        <p className="text-sm text-[var(--destructive)]">
          No se pudo mostrar el login: {error}
        </p>
      )}
      <div
        className={
          portalCargado
            ? "flex w-full items-center justify-between gap-4 border-b border-[var(--border)] bg-card px-4 py-1.5"
            : "flex w-full items-center justify-end gap-4"
        }
      >
        {portalCargado && <CarpetaIngesta compact />}
        <button
          type="button"
          onClick={cambiarUsuario}
          className={
            portalCargado
              ? "shrink-0 text-xs text-[var(--muted-foreground)] hover:text-foreground"
              : "text-sm font-medium text-[var(--muted-foreground)] underline underline-offset-4 hover:text-foreground"
          }
        >
          Cambiar de usuario
        </button>
      </div>
      <div
        ref={placeholderRef}
        className={
          portalCargado
            ? "w-full flex-1"
            : "h-[420px] w-full shrink-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-card shadow-elev-2"
        }
      />
      {/* QR de la APP y carpeta de ingesta van DEBAJO del login, no arriba: con el QR (175px)
          y la tarjeta de carpeta por encima, el cuadro de 420px del login caía fuera de la
          vista en una ventana normal y no se llegaba ni al formulario ni a "Cambiar de
          usuario" sin scrollear (reporte real 2026-09-08). Va después del placeholder y no
          antes por dos razones: el nodo con el ref tiene que conservar su posición entre las
          dos variantes de layout (ver el comentario de arriba), y este bloque tiene que caer
          fuera del rectángulo del WebContentsView, que tapa cualquier HTML bajo sus bounds. */}
      <div className={portalCargado ? "hidden" : "w-full"}>
        <QrAppQr />
        <AccesoPuestoAft />
        <CarpetaIngesta />
      </div>
    </div>
  );
}
