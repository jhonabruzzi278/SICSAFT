import { contextBridge, ipcRenderer } from "electron";
import type { CcpDesktopApi, EstadoConexion } from "@shared/ipc-contract";

const api: CcpDesktopApi = {
  onEstadoConexion: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      estado: EstadoConexion,
    ): void => callback(estado);
    ipcRenderer.on("ccp-desktop:estadoConexion", listener);
    return () =>
      ipcRenderer.removeListener("ccp-desktop:estadoConexion", listener);
  },
  buscarDeNuevo: () => ipcRenderer.invoke("ccp-desktop:buscarDeNuevo"),
  conectarManual: (ip) => ipcRenderer.invoke("ccp-desktop:conectarManual", ip),
};

contextBridge.exposeInMainWorld("ccpDesktop", api);
