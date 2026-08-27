import { useEffect, useState } from "react";
import type { EstadoServicios } from "@shared/ipc-contract";
import { PasoIniciandoServicios } from "./wizard/PasoIniciandoServicios";
import { WizardApp } from "./wizard/WizardApp";

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
    Object.keys(estadoServicios).length > 0 &&
    Object.values(estadoServicios).every((s) => s.estado === "listo");

  if (!estadoServicios || !todosListos) {
    return <PasoIniciandoServicios estado={estadoServicios ?? {}} />;
  }

  return <WizardApp />;
}
