import { useEffect, useState } from "react";
import type { EstadoServicios, NombreServicio } from "@shared/ipc-contract";
import { PasoIniciandoServicios } from "./wizard/PasoIniciandoServicios";
import { WizardApp } from "./wizard/WizardApp";

// Bug real encontrado con el wizard corriendo de punta a punta por primera vez (2026-08-27):
// "cis" arranca recién en medio del wizard (ver ServiceOrchestrator.iniciarCis(), llamado desde
// el paso 1), a propósito -- no en iniciarTodo() como el resto. Si el gate de acá abajo exige los
// 5 servicios "listo" (incluyendo cis), la ventana de tiempo en la que cis pasa por "iniciando"
// tapa el wizard entero con el splash otra vez -- lo que DESMONTA <WizardApp> y pierde todo el
// progreso (el paso en el que estaba el vendedor, los datos ya tipeados). Cuando cis termina de
// arrancar y el splash se saca, <WizardApp> se remonta de cero en el paso 1 -- confundía al
// vendedor (reenvió el mismo formulario, chocó con un realm que ya existía, HTTP 409). El splash
// inicial de acá solo debe cubrir los servicios que arrancan SIEMPRE junto con la app
// (iniciarTodo()) -- el estado de "cis" durante el paso 1 ya lo maneja el propio botón
// "Continuar" de PasoDatosCliente.tsx (disabled + "Configurando…" mientras espera).
const SERVICIOS_ARRANQUE_INICIAL: NombreServicio[] = [
  "postgres",
  "keycloak",
  "core",
  "cip",
];

// Raíz de la app -- decide entre "todavía arrancando servicios embebidos" (splash, CORE-RNF-02)
// y el wizard real. No hay routing de verdad todavía (react-router) -- con una sola pantalla
// visible a la vez no hace falta, se agrega si este scaffold crece a más vistas (ej. las vistas
// embebidas de web_admin/core-frontend, ver ARCHITECTURE.md).
export function App() {
  const [estadoServicios, setEstadoServicios] =
    useState<EstadoServicios | null>(null);

  useEffect(() => {
    window.sicsaftCore
      .getEstadoServicios()
      .then(setEstadoServicios)
      .catch(() => setEstadoServicios({}));
    return window.sicsaftCore.onEstadoServiciosChanged(setEstadoServicios);
  }, []);

  const todosListos =
    estadoServicios !== null &&
    SERVICIOS_ARRANQUE_INICIAL.every(
      (nombre) => estadoServicios[nombre]?.estado === "listo",
    );

  if (!estadoServicios || !todosListos) {
    return <PasoIniciandoServicios estado={estadoServicios ?? {}} />;
  }

  return <WizardApp />;
}
