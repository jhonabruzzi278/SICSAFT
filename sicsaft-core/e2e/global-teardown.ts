import { restaurar } from "./scripts/appdata";

// Restaura `%APPDATA%\sicsaft-core` del desarrollador. Si KEEP_APPDATA=1, deja los datos de la
// corrida en su lugar (depuración) -- el backup queda igual, con nombre con marca de tiempo.
export default function globalTeardown(): void {
  if (process.env.KEEP_APPDATA === "1") {
    console.log("[e2e] KEEP_APPDATA=1 -- no restauro %APPDATA%\\sicsaft-core");
    return;
  }
  restaurar();
  console.log("[e2e] %APPDATA%\\sicsaft-core restaurado");
}
