export type HojaExcel = {
  nombre: string;
  encabezados: string[];
  filas: (string | number)[][];
};

export function exportarExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const worksheets = hojas
    .map(
      (h) => `
        <x:ExcelWorksheet>
          <x:Name>${esc(h.nombre)}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>`
    )
    .join("");

  const tables = hojas
    .map((h) => {
      const thead = `<tr>${h.encabezados.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>`;
      const tbody = h.filas
        .map((f) => `<tr>${f.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`)
        .join("");
      return `<table>${thead}${tbody}</table>`;
    })
    .join("");

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head>
    <meta charset="UTF-8" />
    <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>${worksheets}</x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
    <![endif]-->
    <style>
      th { font-weight: bold; background-color: #dbeafe; }
      td, th { border: 1px solid #cbd5e1; padding: 4px 8px; }
    </style>
  </head>
  <body>${tables}</body>
</html>`;

  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
