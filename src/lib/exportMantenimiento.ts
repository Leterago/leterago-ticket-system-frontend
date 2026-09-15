import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { SolicitudMantenimientoPayload } from "../forms/SolicitudMantenimientoForm";
import type { Ticket } from "../types/types";
import logoUrl from "../assets/for077-logo.png";

// ─── Reproduces FOR-077 "Orden de Trabajo de Mantenimiento" V-4 exactly. ────────
// Only the fields captured by the app are filled in; the rest match the blank form.

const FONT  = "Verdana";
const BLACK = "000000";
const WHITE = "FFFFFF";
const DARK  = "1F2937";
// Verdana no trae ☒/☐: sin una fuente que los tenga, Word los sustituye mal.
const SYMBOL_FONT = "Segoe UI Symbol";

// A4 portrait with the original form's margins (twips). Los márgenes laterales se
// redujeron a 850 (1.5 cm) para aprovechar el ancho de la hoja; todo lo demás deriva de CW.
const PAGE   = { width: 11906, height: 16838 };
const MARGIN = { top: 1411, right: 850, bottom: 1134, left: 850, header: 706, footer: 706 };
const CW     = PAGE.width - MARGIN.left - MARGIN.right; // 8508 — content width

// Main info table columns (LEFT label/value · MID prioridad · RIGHT área), original proportions.
const LEFT  = Math.round(CW * 3790 / 11073);
const MID   = Math.round(CW * 1914 / 11073);
const RIGHT = CW - LEFT - MID;

// "Realizado por" grid columns (original proportions).
const RP = [
  Math.round(CW * 2518 / 11073), // Fecha
  Math.round(CW * 5528 / 11073), // Nombre
  Math.round(CW * 1560 / 11073), // Hora inicio
  0,
];
RP[3] = CW - RP[0] - RP[1] - RP[2]; // Hora término

// Header columns: logo · título · bloque documento.
// The logo is an INLINE image, so the cell clips it if too narrow — keep H_LOGO
// comfortably wider than the image (150px ≈ 112.5pt ≈ 1607 twips) plus overhead.
const H_LOGO = 2700;
const H_INFO = 2050;
const H_TITLE = CW - H_LOGO - H_INFO;
const LOGO_W = 150;
const LOGO_H = 58;

const PRIORITY_NIVEL: Record<string, string> = {
  urgent: "Urgente", high: "Importante", medium: "Normal", low: "Normal",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Formatting helpers ─────────────────────────────────────────────────────────

function fmtFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${MESES[d.getMonth()]}-${d.getFullYear()}`;
}

function fmtHora(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Form date inputs arrive as "YYYY-MM-DD"; render as DD/MM/YYYY. */
function fmtRegFecha(v?: string): string {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function run(
  text: string,
  opts: { bold?: boolean; color?: string; size?: number; italic?: boolean } = {},
): TextRun {
  return new TextRun({
    text,
    bold:    opts.bold,
    italics: opts.italic,
    color:   opts.color ?? DARK,
    size:    opts.size  ?? 18, // half-points (18 = 9 pt)
    font:    FONT,
  });
}

function p(
  runs: TextRun[],
  align?: (typeof AlignmentType)[keyof typeof AlignmentType],
  spacing: { before?: number; after?: number } = { before: 30, after: 30 },
): Paragraph {
  return new Paragraph({ alignment: align, spacing, children: runs });
}

const SOLID = (color: string) => ({
  style: BorderStyle.SINGLE as typeof BorderStyle.SINGLE,
  size: 4,
  color,
});
function box(color = BLACK) {
  const s = SOLID(color);
  return { top: s, bottom: s, left: s, right: s };
}

// Hidden (no-line) border, used to suppress the internal vertical dividers in the
// top info table — the original form shows only horizontal row lines + the outer box.
const NB = { style: BorderStyle.NONE as typeof BorderStyle.NONE, size: 0, color: "auto" };
function bdr(t: boolean, b: boolean, l: boolean, r: boolean) {
  const s = SOLID(BLACK);
  return { top: t ? s : NB, bottom: b ? s : NB, left: l ? s : NB, right: r ? s : NB };
}

// ─── Cell factories ─────────────────────────────────────────────────────────────

type Borders = ReturnType<typeof bdr>; // each side may be a line or hidden (NB)

function fieldCell(
  label: string,
  value: string,
  width: number,
  opts: { span?: number; rowSpan?: number; borders?: Borders } = {},
): TableCell {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    columnSpan:    opts.span,
    rowSpan:       opts.rowSpan,
    borders:       opts.borders ?? box(),
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 40, bottom: 40, left: 80, right: 80 },
    children: [p([
      run(`${label} `, { bold: true }),
      run(value),
    ])],
  });
}

function emptyCell(width: number, span?: number, borders?: Borders): TableCell {
  return new TableCell({
    width:      { size: width, type: WidthType.DXA },
    columnSpan: span,
    borders:    borders ?? box(),
    children:   [p([run("")])],
  });
}

/** Full-width black section bar (white, bold, centered). */
function sectionBar(text: string): Table {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [CW],
    rows: [new TableRow({
      children: [new TableCell({
        width:         { size: CW, type: WidthType.DXA },
        borders:       box(),
        shading:       { type: ShadingType.SOLID, color: BLACK, fill: BLACK },
        verticalAlign: VerticalAlign.CENTER,
        children:      [p([run(text, { bold: true, color: WHITE, size: 22 })], AlignmentType.CENTER, { before: 40, after: 40 })],
      })],
    })],
  });
}

function gap(): Paragraph {
  return new Paragraph({ spacing: { before: 120, after: 0 }, children: [] });
}

// ─── Header / footer ─────────────────────────────────────────────────────────────

function buildHeader(logoData: ArrayBuffer | null): Header {
  const logoChildren = logoData
    ? [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: "png", data: logoData, transformation: { width: LOGO_W, height: LOGO_H } })],
      })]
    : [p([run("LETERAGO", { bold: true, color: "0047AC", size: 28 })], AlignmentType.CENTER)];

  // Right-side document-info block (nested table, line-separated rows).
  const infoRow = (children: Paragraph[]) =>
    new TableRow({ children: [new TableCell({
      width: { size: H_INFO, type: WidthType.DXA },
      borders: box(),
      margins: { top: 10, bottom: 10, left: 60, right: 60 },
      children,
    })] });

  const infoTable = new Table({
    width: { size: H_INFO, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [H_INFO],
    rows: [
      infoRow([p([run("Documento No.:", { size: 14 })], undefined, { before: 0, after: 0 }),
               p([run("FOR-077", { bold: true, size: 14 })], undefined, { before: 0, after: 0 })]),
      infoRow([p([run("Versión: ", { size: 14 }), run("4", { bold: true, size: 14 })], undefined, { before: 0, after: 0 })]),
      infoRow([p([run("Doc. Relacionado:", { size: 14 })], undefined, { before: 0, after: 0 }),
               p([run("PNT-111", { bold: true, size: 14 })], undefined, { before: 0, after: 0 })]),
      infoRow([p([run("Página ", { size: 14 }), run("1", { bold: true, size: 14 }),
                  run(" de ", { size: 14 }), run("1", { bold: true, size: 14 })], undefined, { before: 0, after: 0 })]),
    ],
  });

  const headerTable = new Table({
    width: { size: CW, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [H_LOGO, H_TITLE, H_INFO],
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: H_LOGO, type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER, margins: { top: 20, bottom: 20, left: 40, right: 40 }, children: logoChildren }),
        new TableCell({ width: { size: H_TITLE, type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER,
          children: [p([run("ORDEN DE TRABAJO DE MANTENIMIENTO", { bold: true, size: 22 })], AlignmentType.CENTER)] }),
        new TableCell({ width: { size: H_INFO, type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER,
          margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [infoTable] }),
      ],
    })],
  });

  return new Header({ children: [headerTable] });
}

function buildFooter(): Footer {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run(
        "DOCUMENTO CONFIDENCIAL PARA USO EXCLUSIVO DE LETERAGO SRL Y SUS AFILIADOS, REVISADO Y APROBADO MEDIANTE FIRMA ELECTRÓNICA.",
        { bold: true, size: 14, color: BLACK },
      )],
    })],
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/** Datos que no viven en el ticket ni en el payload y los resuelve la página. */
export type ExportMantenimientoOpts = {
  /** Departamento de origen del solicitante (etiqueta legible). */
  departamento?: string;
};

export async function exportMantenimientoDocx(
  ticket: Ticket,
  payload: SolicitudMantenimientoPayload,
  opts: ExportMantenimientoOpts = {},
): Promise<void> {
  let logoData: ArrayBuffer | null = null;
  try {
    logoData = await fetch(logoUrl).then((r) => r.arrayBuffer());
  } catch {
    logoData = null;
  }

  const nivel = PRIORITY_NIVEL[ticket.priority] ?? "Normal";

  /** Casilla del nivel de prioridad: el glifo va con fuente propia o Word no lo dibuja. */
  const nivelLinea = (opt: string) => {
    const marcada = nivel === opt;
    return p(
      [
        new TextRun({ text: marcada ? "☒" : "☐", font: SYMBOL_FONT, size: 20, color: DARK }),
        run(` ${opt}`, { size: 18, bold: marcada }),
      ],
      AlignmentType.LEFT,
      { before: 10, after: 10 },
    );
  };

  const ubicacion = payload.ubicacion === "otro"
    ? (payload.otraUbicacion || "")
    : (payload.ubicacion || "");

  const EMPTY_ROW = { fecha: "", realizadoPor: "", horaInicio: "", horaTermino: "" };
  const base = payload.registros?.length ? payload.registros : [];
  const registros = base.length >= 3 ? base : [...base, ...Array(3 - base.length).fill(EMPTY_ROW)];

  // ── "NIVEL DE PRIORIDAD" merged cell content ──
  const nivelCell = new TableCell({
    width:         { size: MID, type: WidthType.DXA },
    rowSpan:       3,
    borders:       bdr(false, true, false, false), // only bottom (table edge); no vertical dividers
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      p([run("NIVEL DE", { bold: true, size: 16 })], AlignmentType.CENTER, { before: 0, after: 0 }),
      p([run("PRIORIDAD", { bold: true, size: 16 })], AlignmentType.CENTER, { before: 0, after: 60 }),
      nivelLinea("Urgente"),
      nivelLinea("Importante"),
      nivelLinea("Normal"),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: PAGE, margin: MARGIN },
      },
      headers: { default: buildHeader(logoData) },
      footers: { default: buildFooter() },
      children: [

        // ── No. de Orden (right-aligned box) ──
        new Table({
          width: { size: Math.round(CW * 0.42), type: WidthType.DXA },
          alignment: AlignmentType.RIGHT,
          layout: TableLayoutType.FIXED,
          columnWidths: [Math.round(CW * 0.42)],
          rows: [new TableRow({
            children: [new TableCell({
              borders:       box(),
              verticalAlign: VerticalAlign.CENTER,
              margins:       { top: 40, bottom: 40, left: 100, right: 80 },
              children: [p([run("No. de Orden: ", { bold: true, size: 20 }), run(ticket.id, { size: 20 })])],
            })],
          })],
        }),

        gap(),

        // ── Main info table ──
        new Table({
          width: { size: CW, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [LEFT, MID, RIGHT],
          // Internal vertical dividers are suppressed (bdr): only the outer box and
          // horizontal row lines are visible, matching the original form.
          rows: [
            new TableRow({ children: [
              fieldCell("Fecha:", fmtFecha(ticket.createdAt), LEFT, { borders: bdr(true, true, true, false) }),
              // Open top-right corner (no top, no right border) — matches the original form.
              emptyCell(MID + RIGHT, 2, bdr(false, true, false, false)),
            ] }),
            new TableRow({ children: [
              fieldCell("Hora:", fmtHora(ticket.createdAt), LEFT, { borders: bdr(false, true, true, false) }),
              nivelCell,
              fieldCell("Área o Equipo:", payload.area || "", RIGHT, { borders: bdr(false, true, false, true) }),
            ] }),
            new TableRow({ children: [
              fieldCell("Solicitado por:", ticket.createdBy ?? "", LEFT, { borders: bdr(false, true, true, false) }),
              fieldCell("Código:", payload.codigo || "", RIGHT, { borders: bdr(false, true, false, true) }),
            ] }),
            new TableRow({ children: [
              fieldCell("Departamento:", opts.departamento ?? "", LEFT, { borders: bdr(false, true, true, false) }),
              fieldCell("Ubicación:", ubicacion, RIGHT, { borders: bdr(false, true, false, true) }),
            ] }),
          ],
        }),

        gap(),

        // ── Descripción ──
        sectionBar("DESCRIPCION TRABAJO O SOLICITUD"),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [CW],
          rows: [new TableRow({
            height: { value: 1400, rule: HeightRule.ATLEAST },
            children: [new TableCell({
              width: { size: CW, type: WidthType.DXA },
              borders: box(),
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [p([run(ticket.description || "")], undefined, { before: 0, after: 0 })],
            })],
          })],
        }),

        gap(),

        // ── Realizado por ──
        sectionBar("REALIZADO POR"),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: RP,
          rows: [
            new TableRow({ children: ["Fecha", "Nombre", "Hora Inicio", "Hora Termino"].map((h, i) =>
              new TableCell({
                width: { size: RP[i], type: WidthType.DXA },
                borders: box(),
                verticalAlign: VerticalAlign.CENTER,
                children: [p([run(h, { bold: true })], AlignmentType.CENTER, { before: 20, after: 20 })],
              })
            ) }),
            ...registros.map((r) => new TableRow({
              height: { value: 360, rule: HeightRule.ATLEAST },
              children: [
                new TableCell({ width: { size: RP[0], type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER, children: [p([run(fmtRegFecha(r.fecha))], AlignmentType.CENTER)] }),
                new TableCell({ width: { size: RP[1], type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER, margins: { top: 20, bottom: 20, left: 80, right: 80 }, children: [p([run(r.realizadoPor || "")])] }),
                new TableCell({ width: { size: RP[2], type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER, children: [p([run(r.horaInicio || "")], AlignmentType.CENTER)] }),
                new TableCell({ width: { size: RP[3], type: WidthType.DXA }, borders: box(), verticalAlign: VerticalAlign.CENTER, children: [p([run(r.horaTermino || "")], AlignmentType.CENTER)] }),
              ],
            })),
          ],
        }),

        gap(),

        // ── Observaciones ──
        sectionBar("OBSERVACIONES"),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [CW],
          rows: [new TableRow({
            height: { value: 1500, rule: HeightRule.ATLEAST },
            children: [new TableCell({
              width: { size: CW, type: WidthType.DXA },
              borders: box(),
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                p([run(payload.observaciones || "")], undefined, { before: 0, after: 0 }),
              ],
            })],
          })],
        }),

        gap(),

        // ── Recibe conforme / Fecha ──
        new Table({
          width: { size: CW, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [Math.round(CW * 0.66), CW - Math.round(CW * 0.66)],
          rows: [new TableRow({
            height: { value: 520, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                width: { size: Math.round(CW * 0.66), type: WidthType.DXA },
                borders: box(),
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [p([run("Recibe conforme: ", { bold: true }), run(ticket.createdBy ?? "")])],
              }),
              new TableCell({
                width: { size: CW - Math.round(CW * 0.66), type: WidthType.DXA },
                borders: box(),
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [p([run("Fecha: ", { bold: true })])],
              }),
            ],
          })],
        }),

      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${ticket.id}_FOR-077.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
