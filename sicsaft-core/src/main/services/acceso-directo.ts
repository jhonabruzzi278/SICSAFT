// DOC-028 Fase G -- acceso directo de Internet de Windows (.url, formato INI) que abre el CCP de la
// PC madre en el navegador predeterminado de la PC del Profesional de AFT. En esa PC no se instala
// el .exe (crearía una segunda BPI): este archivo en el escritorio es todo lo que necesita. CRLF
// porque es un archivo de Windows.
export const NOMBRE_ACCESO_DIRECTO = "SICSAFT CCP.url";

// `origen` lo arma el proceso principal (obtenerOrigenCcpLan: https + IPv4 de LAN validada + puerto
// fijo), no llega del renderer. Igual se rechaza cualquier valor con salto de línea: una línea de
// más en un INI podría agregar claves al acceso directo.
export function contenidoAccesoDirecto(origen: string): string {
  if (/[\r\n]/.test(origen) || !origen.startsWith("https://")) {
    throw new Error(`Origen inválido para el acceso directo: ${origen}`);
  }
  return `[InternetShortcut]\r\nURL=${origen}/\r\n`;
}
