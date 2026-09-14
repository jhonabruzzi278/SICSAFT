import type { EstadoConexion } from "@shared/ipc-contract";

const mensaje = document.getElementById("mensaje") as HTMLParagraphElement;
const spinner = document.getElementById("spinner") as HTMLDivElement;
const formManual = document.getElementById("form-manual") as HTMLFormElement;
const inputIp = document.getElementById("ip-manual") as HTMLInputElement;
const botonReintentar = document.getElementById(
  "reintentar",
) as HTMLButtonElement;

function mostrarEstado(estado: EstadoConexion): void {
  mensaje.classList.remove("error");
  formManual.hidden = true;
  botonReintentar.hidden = true;
  spinner.hidden = false;
  switch (estado.fase) {
    case "buscando":
      mensaje.textContent = "Buscando la PC madre en la red…";
      break;
    case "conectando":
      mensaje.textContent = `Conectando con ${estado.nombre} (${estado.ip})…`;
      break;
    case "sin-respuesta":
      spinner.hidden = true;
      mensaje.textContent =
        "No se encontró ninguna PC madre en esta red. Verificá que sicsaft-core.exe esté abierto ahí, o ingresá la dirección a mano.";
      formManual.hidden = false;
      botonReintentar.hidden = false;
      break;
    case "error":
      spinner.hidden = true;
      mensaje.classList.add("error");
      mensaje.textContent = estado.mensaje;
      formManual.hidden = false;
      botonReintentar.hidden = false;
      break;
  }
}

window.ccpDesktop.onEstadoConexion(mostrarEstado);
formManual.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const ip = inputIp.value.trim();
  if (!ip) return;
  mostrarEstado({ fase: "conectando", ip, nombre: "conexión manual" });
  void window.ccpDesktop.conectarManual(ip).then((resultado) => {
    if (!resultado.ok)
      mostrarEstado({
        fase: "error",
        mensaje: resultado.error ?? "No se pudo conectar a esa dirección.",
      });
  });
});
botonReintentar.addEventListener("click", () => {
  void window.ccpDesktop.buscarDeNuevo();
});
