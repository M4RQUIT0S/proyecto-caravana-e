// Saneo anti "CSV/Formula Injection" (CWE-1236). Una celda de texto libre que empieza con
// `= + - @` (o tab/CR) es interpretada como fórmula por Excel/Sheets/LibreOffice al abrir el
// archivo exportado. Anteponer un apóstrofo neutraliza la fórmula sin alterar el dato visible.
// Se aplica a TODO valor string antes de Papa.unparse / XLSX.utils.json_to_sheet.

const PELIGROSO = /^[=+\-@\t\r]/;

function sanitizarValor<T>(v: T): T | string {
  if (typeof v === "string" && PELIGROSO.test(v)) return `'${v}`;
  return v;
}

// Devuelve una copia de cada fila con sus valores string saneados.
export function sanitizarFilas<T extends object>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = sanitizarValor(v);
    return out as T;
  });
}
