import { jsPDF } from 'jspdf';
import type { VeredictoControl } from './cis-client';

// DOC-035 — botón "Descargar PDF" del reporte de Control BPI (PantallaControlArea.tsx). Un solo
// archivo, una sola función exportada: arma el PDF a partir del mismo view-model ya calculado en
// pantalla (nada se recalcula acá). Texto vectorial dibujado a mano con jsPDF (sin
// jspdf-autotable ni html2canvas) — más liviano que capturar el DOM y nítido a cualquier zoom.

export interface InformeControlPdfKpi {
  titulo: string;
  valor: string;
  dato: string;
}

export interface InformeControlPdfHallazgo {
  severidad: 'critico' | 'atencion';
  texto: string;
  etiqueta?: string;
}

export interface InformeControlPdfCategoria {
  nombre: string;
  cantidad: number;
  porcentaje: string;
}

export interface InformeControlPdfEstado {
  etiqueta: string;
  cantidad: number;
}

export interface InformeControlPdfFila {
  codigoQr: string;
  nombre: string;
  extra?: string;
}

export interface InformeControlPdfLista {
  titulo: string;
  filas: InformeControlPdfFila[];
}

export interface InformeControlPdfInput {
  areaNombre: string;
  direccionNombre: string | null;
  departamentoNombre: string | null;
  fechaInicio: string;
  fechaCierre: string;
  operadorId: string;
  veredicto: VeredictoControl;
  veredictoEtiqueta: string;
  kpis: InformeControlPdfKpi[];
  hallazgos: InformeControlPdfHallazgo[];
  categorias: InformeControlPdfCategoria[];
  estadoDeclarado: InformeControlPdfEstado[];
  listas: InformeControlPdfLista[];
}

const MARGEN_X = 14;
const ANCHO_UTIL = 182; // A4 (210mm) - 2*MARGEN_X
const ALTO_PAGINA = 297; // A4 en mm
const MARGEN_INFERIOR = 20;

const COLOR_VEREDICTO: Record<VeredictoControl, [number, number, number]> = {
  exitoso: [22, 163, 74],
  aceptable: [217, 119, 6],
  defectuoso: [220, 38, 38],
};

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

// Cursor vertical compartido entre las secciones — evita pasar `y` como parámetro mutable en
// cada llamada. Un `addPage()` cuando una sección no entra en lo que queda de la hoja.
class CursorPdf {
  y = 20;
  constructor(private readonly doc: jsPDF) {}

  saltoDePaginaSiNecesario(alturaEstimada: number): void {
    if (this.y + alturaEstimada > ALTO_PAGINA - MARGEN_INFERIOR) {
      this.doc.addPage();
      this.y = 20;
    }
  }

  avanzar(mm: number): void {
    this.y += mm;
  }
}

function dibujarEncabezado(
  doc: jsPDF,
  cursor: CursorPdf,
  datos: InformeControlPdfInput,
): void {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Reporte de control — ${datos.areaNombre}`, MARGEN_X, cursor.y);
  cursor.avanzar(6);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const ruta = [datos.direccionNombre, datos.departamentoNombre]
    .filter((v): v is string => Boolean(v))
    .join(' → ');
  if (ruta) {
    doc.text(ruta, MARGEN_X, cursor.y);
    cursor.avanzar(5);
  }
  doc.text(
    `Sesión del ${formatFechaHora(datos.fechaCierre)} · Operador: ${datos.operadorId}`,
    MARGEN_X,
    cursor.y,
  );
  cursor.avanzar(8);

  const [r, g, b] = COLOR_VEREDICTO[datos.veredicto];
  doc.setFillColor(r, g, b);
  doc.roundedRect(MARGEN_X, cursor.y - 5, 55, 8, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Proceso ${datos.veredictoEtiqueta}`, MARGEN_X + 27.5, cursor.y, {
    align: 'center',
  });
  doc.setTextColor(0, 0, 0);
  cursor.avanzar(12);
}

function dibujarKpis(
  doc: jsPDF,
  cursor: CursorPdf,
  kpis: InformeControlPdfKpi[],
): void {
  cursor.saltoDePaginaSiNecesario(20);
  const columnas = 4;
  const anchoColumna = ANCHO_UTIL / columnas;
  kpis.forEach((kpi, i) => {
    const x = MARGEN_X + (i % columnas) * anchoColumna;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.titulo, x, cursor.y);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.valor, x, cursor.y + 6);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.dato, x, cursor.y + 10.5, { maxWidth: anchoColumna - 4 });
  });
  cursor.avanzar(18);
}

function dibujarTitulo(doc: jsPDF, cursor: CursorPdf, texto: string): void {
  cursor.saltoDePaginaSiNecesario(10);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(texto, MARGEN_X, cursor.y);
  cursor.avanzar(6);
  doc.setFont('helvetica', 'normal');
}

function dibujarHallazgos(
  doc: jsPDF,
  cursor: CursorPdf,
  hallazgos: InformeControlPdfHallazgo[],
): void {
  dibujarTitulo(doc, cursor, 'Hallazgos');
  if (hallazgos.length === 0) {
    doc.setFontSize(9);
    doc.text(
      'Sin hallazgos — todos los AFT del área se escanearon correctamente.',
      MARGEN_X,
      cursor.y,
    );
    cursor.avanzar(8);
    return;
  }
  doc.setFontSize(9);
  for (const h of hallazgos) {
    cursor.saltoDePaginaSiNecesario(6);
    const etiqueta = `[${h.etiqueta ?? (h.severidad === 'critico' ? 'CRÍTICO' : 'ATENCIÓN')}]`;
    doc.text(`${etiqueta} ${h.texto}`, MARGEN_X, cursor.y);
    cursor.avanzar(5.5);
  }
  cursor.avanzar(3);
}

function dibujarCategorias(
  doc: jsPDF,
  cursor: CursorPdf,
  categorias: InformeControlPdfCategoria[],
): void {
  dibujarTitulo(doc, cursor, 'AFT por categoría');
  doc.setFontSize(9);
  if (categorias.length === 0) {
    doc.text('Sin datos de categoría disponibles.', MARGEN_X, cursor.y);
    cursor.avanzar(8);
    return;
  }
  for (const c of categorias) {
    cursor.saltoDePaginaSiNecesario(6);
    doc.text(
      `${c.nombre}: ${c.cantidad} (${c.porcentaje}%)`,
      MARGEN_X,
      cursor.y,
    );
    cursor.avanzar(5.5);
  }
  cursor.avanzar(3);
}

function dibujarEstadoDeclarado(
  doc: jsPDF,
  cursor: CursorPdf,
  estados: InformeControlPdfEstado[],
): void {
  dibujarTitulo(doc, cursor, 'Estado de los AFT declarado por el controlador');
  doc.setFontSize(9);
  const linea = estados
    .map((e) => `${e.etiqueta}: ${e.cantidad}`)
    .join('   ·   ');
  cursor.saltoDePaginaSiNecesario(6);
  doc.text(linea, MARGEN_X, cursor.y);
  cursor.avanzar(9);
}

function dibujarLista(
  doc: jsPDF,
  cursor: CursorPdf,
  lista: InformeControlPdfLista,
): void {
  dibujarTitulo(doc, cursor, `${lista.titulo} (${lista.filas.length})`);
  doc.setFontSize(8.5);
  if (lista.filas.length === 0) {
    doc.text('— ninguno —', MARGEN_X, cursor.y);
    cursor.avanzar(7);
    return;
  }
  for (const f of lista.filas) {
    cursor.saltoDePaginaSiNecesario(5);
    const texto = f.extra
      ? `${f.codigoQr} — ${f.nombre} (${f.extra})`
      : `${f.codigoQr} — ${f.nombre}`;
    doc.text(texto, MARGEN_X, cursor.y, { maxWidth: ANCHO_UTIL });
    cursor.avanzar(4.8);
  }
  cursor.avanzar(3);
}

export function generarPdfInformeControl(datos: InformeControlPdfInput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cursor = new CursorPdf(doc);

  dibujarEncabezado(doc, cursor, datos);
  dibujarKpis(doc, cursor, datos.kpis);
  dibujarHallazgos(doc, cursor, datos.hallazgos);
  dibujarCategorias(doc, cursor, datos.categorias);
  dibujarEstadoDeclarado(doc, cursor, datos.estadoDeclarado);
  for (const lista of datos.listas) {
    dibujarLista(doc, cursor, lista);
  }

  const nombreArchivo = `informe-control-${datos.areaNombre.replace(/\s+/g, '-').toLowerCase()}-${datos.fechaCierre.slice(0, 10)}.pdf`;
  doc.save(nombreArchivo);
}
