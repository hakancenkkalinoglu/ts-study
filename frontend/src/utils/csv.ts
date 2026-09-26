export type CsvCell = string | number | null | undefined;

// Türkçe Excel liste ayırıcısı olarak noktalı virgül kullanır, virgül ondalık ayırıcıdır.
const SEPARATOR = ';';

// Görünmez karakteri kaynakta gizlememek için koddan üretilir.
const BOM = String.fromCharCode(0xfeff);

// Excel bu karakterlerle başlayan metni formül sayar (CSV enjeksiyonu). Başına ' koyarak metin kalmasını sağlarız.
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: CsvCell): string => {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(Math.round(value * 100) / 100).replace('.', ',');
  }
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

/** UTF-8 BOM ile başlar, yoksa Excel Türkçe karakterleri bozar. Satır sonu CRLF. */
export const toCsv = (rows: CsvCell[][]): string =>
  `${BOM}${rows.map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n')}\r\n`;

export const downloadCsv = (fileName: string, rows: CsvCell[][]) => {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
