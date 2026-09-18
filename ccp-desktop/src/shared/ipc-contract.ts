export type EstadoConexion =
  | { fase: "buscando" }
  | { fase: "conectando"; ip: string; nombre: string }
  | { fase: "sin-respuesta" }
  | { fase: "error"; mensaje: string };

export interface ResultadoConexionManual {
  ok: boolean;
  error?: string;
}

export interface CcpDesktopApi {
  onEstadoConexion: (callback: (estado: EstadoConexion) => void) => () => void;
  buscarDeNuevo: () => Promise<void>;
  conectarManual: (ip: string) => Promise<ResultadoConexionManual>;
}
