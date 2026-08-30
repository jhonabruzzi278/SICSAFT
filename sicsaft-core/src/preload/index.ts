import { contextBridge, ipcRenderer } from "electron";
import type { SicsaftCoreApi, EstadoServicios } from "@shared/ipc-contract";

// Único punto de contacto entre el renderer (sandboxeado, sin Node) y el proceso principal --
// cada método es un wrapper delgado sobre ipcRenderer.invoke/on, tipado contra
// shared/ipc-contract.ts para que el renderer nunca llame un canal con el nombre mal escrito sin
// que TypeScript lo marque.
const api: SicsaftCoreApi = {
  getEstadoServicios: () =>
    ipcRenderer.invoke("sicsaft-core:getEstadoServicios"),
  getInstalacionExistente: () =>
    ipcRenderer.invoke("sicsaft-core:getInstalacionExistente"),
  getEstadoIpLan: () => ipcRenderer.invoke("sicsaft-core:getEstadoIpLan"),
  reconfigurarIpLan: () => ipcRenderer.invoke("sicsaft-core:reconfigurarIpLan"),
  getUrlAppQr: () => ipcRenderer.invoke("sicsaft-core:getUrlAppQr"),
  bootstrapCliente: (input) =>
    ipcRenderer.invoke("sicsaft-core:bootstrapCliente", input),
  altaDirector: (input) =>
    ipcRenderer.invoke("sicsaft-core:altaDirector", input),
  altaProfesionalAft: (input) =>
    ipcRenderer.invoke("sicsaft-core:altaProfesionalAft", input),
  mostrarPortalEmbebido: (bounds, forzarNuevoLogin) =>
    ipcRenderer.invoke(
      "sicsaft-core:mostrarPortalEmbebido",
      bounds,
      forzarNuevoLogin,
    ),
  actualizarBoundsPortalEmbebido: (bounds) =>
    ipcRenderer.send("sicsaft-core:actualizarBoundsPortalEmbebido", bounds),
  onEstadoServiciosChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      estado: EstadoServicios,
    ): void => callback(estado);
    ipcRenderer.on("sicsaft-core:estadoServiciosChanged", listener);
    // Devuelve el "unsubscribe" -- el renderer lo llama en el cleanup de su useEffect, evita
    // acumular listeners duplicados si el componente se remonta.
    return () =>
      ipcRenderer.removeListener(
        "sicsaft-core:estadoServiciosChanged",
        listener,
      );
  },
};

contextBridge.exposeInMainWorld("sicsaftCore", api);
