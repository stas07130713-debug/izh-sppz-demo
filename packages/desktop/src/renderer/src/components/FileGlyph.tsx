/**
 * Значок файла — лист с загнутым углом и подписью расширения.
 *
 * Рисуется, а не берётся картинкой: расширений у проектной документации много
 * (pdf, dwg, docx, zip), и заводить отдельный файл под каждое значило бы
 * держать десяток картинок ради подписи из трёх букв. Незнакомое расширение
 * при этом рисуется само собой — как есть.
 *
 * Цвет по виду документа: чертежи, таблицы и тексты различают по цвету
 * корешка так же, как в проводнике, — иначе десяток одинаковых серых листов
 * приходится читать по подписям.
 */

export interface FileGlyphProps {
  readonly fileName: string;
}

/** Расширение заглавными, не длиннее четырёх знаков: больше не влезает в корешок. */
function extensionOf(fileName: string): string {
  const extension = fileName.split('.').pop();
  if (extension === undefined || extension === fileName) return '';
  return extension.toLocaleUpperCase('ru').slice(0, 4);
}

const COLORS: Readonly<Record<string, string>> = {
  PDF: '#dc2626',
  DWG: '#0891b2', DXF: '#0891b2', RVT: '#0891b2',
  DOC: '#2563eb', DOCX: '#2563eb', RTF: '#2563eb', TXT: '#2563eb',
  XLS: '#16a34a', XLSX: '#16a34a', CSV: '#16a34a',
  ZIP: '#ca8a04', RAR: '#ca8a04', '7Z': '#ca8a04',
  JPG: '#7c3aed', JPEG: '#7c3aed', PNG: '#7c3aed', TIF: '#7c3aed', TIFF: '#7c3aed',
};

export function FileGlyph(props: FileGlyphProps): React.JSX.Element {
  const extension = extensionOf(props.fileName);
  const color = COLORS[extension] ?? '#64748b';

  return (
    <svg className="file-glyph" viewBox="0 0 40 48" aria-hidden="true">
      {/* Лист с загнутым углом: узнаваемая форма документа. */}
      <path
        d="M4 2h22l10 10v34a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        fill="var(--bg-elevated)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path d="M26 2v10h10" fill="none" stroke="var(--border)" strokeWidth="1.5" />
      {/* Корешок с расширением. Пустой — у файла без расширения. */}
      {extension !== '' && <>
        <rect x="2" y="26" width="30" height="13" rx="2" fill={color} />
        <text
          x="17" y="35"
          textAnchor="middle"
          fontSize={extension.length > 3 ? 7 : 8.5}
          fill="#fff"
          fontWeight="600"
        >
          {extension}
        </text>
      </>}
    </svg>
  );
}
