export interface PrintPreviewRequest {
  title: string;
  html: string;
  paperSize?: "58mm" | "80mm" | "A4";
}

export const THERMAL_PAGE_WIDTH_MM = 72;
export const THERMAL_PAGE_HEIGHT_MM = 210;
export const THERMAL_DPI = 203;

const thermalPrintStyles = `
  @page { size: ${THERMAL_PAGE_WIDTH_MM}mm ${THERMAL_PAGE_HEIGHT_MM}mm; margin: 0; }
  html, body { width: ${THERMAL_PAGE_WIDTH_MM}mm !important; max-width: ${THERMAL_PAGE_WIDTH_MM}mm !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; background: #fff !important; color: #000 !important; }
  *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
  body { font-size: 10px; line-height: 1.18; overflow-wrap: anywhere; word-break: break-word; }
  img, svg, canvas { max-width: 100% !important; height: auto; image-rendering: auto; }
  table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
  th, td { min-width: 0; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
  .card, .receipt, .print-receipt-only { width: ${THERMAL_PAGE_WIDTH_MM}mm !important; max-width: ${THERMAL_PAGE_WIDTH_MM}mm !important; min-width: 0 !important; margin: 0 !important; padding: 2mm !important; overflow: hidden !important; }
  .preview-toolbar, .no-print { display: none !important; }
`;

export function normalizeThermalHtml(html: string): string {
  const style = `<style data-suitpro-thermal="203dpi">${thermalPrintStyles}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
}

export function requestPrintPreview(request: PrintPreviewRequest): void {
  const normalizedRequest = request.paperSize === "80mm"
    ? { ...request, html: normalizeThermalHtml(request.html) }
    : request;
  window.dispatchEvent(new CustomEvent<PrintPreviewRequest>("suitpro:print-preview", { detail: normalizedRequest }));
}