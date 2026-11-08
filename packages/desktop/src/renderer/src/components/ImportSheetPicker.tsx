/**
 * Выбор разделов переносимого журнала (Дополнение 6, часть С81).
 *
 * Заказчик: «загрузка журнала должна позволять сразу галочками отмечать, какие
 * разделы мы переносим». В учётном журнале предприятия листов десяток —
 * огнетушители, краны, извещатели, — и переносить их по одному, открывая мастер
 * заново, это та же работа, помноженная на десять.
 *
 * Пустые листы не предлагаются. В книгах учёта их всегда несколько: заготовки,
 * инструкции, лист с подписями. Отмечать такой лист незачем, и вместо молчания
 * рядом с ним сказано, почему он не годится: «не содержит данных» и «нет строки
 * заголовков» — разные беды, и лечатся они по-разному.
 */

/** Что известно о листе до сопоставления колонок. */
export interface SheetInfo {
  readonly name: string;
  /** Сколько непустых строк ниже заголовка. */
  readonly dataRows: number;
  /** Номер строки заголовков. null — найти не удалось. */
  readonly headerRow: number | null;
}

export interface ImportSheetPickerProps {
  readonly fileName: string | null;
  readonly sheets: readonly SheetInfo[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (name: string) => void;
  readonly onNext: () => void;
}

/** Годен ли лист к переносу: есть заголовки и есть хоть одна строка данных. */
export function isImportable(sheet: SheetInfo): boolean {
  return sheet.headerRow !== null && sheet.dataRows > 0;
}

/** Короткая пометка у названия листа: её видно, не читая пояснения. */
function badgeOf(sheet: SheetInfo): { readonly text: string; readonly kind: string } | null {
  if (sheet.headerRow === null) return { text: 'не таблица', kind: 'muted' };
  if (sheet.dataRows === 0) return { text: 'пусто', kind: 'warn' };
  return null;
}

function reason(sheet: SheetInfo): string {
  if (sheet.headerRow === null) return 'строка заголовков не найдена — похоже, это не таблица учёта';
  if (sheet.dataRows === 0) return 'ниже заголовков нет ни одной строки';
  return `строк: ${sheet.dataRows}`;
}

export function ImportSheetPicker(props: ImportSheetPickerProps): React.JSX.Element {
  const usable = props.sheets.filter(isImportable);
  const chosen = usable.filter((sheet) => props.selected.has(sheet.name));
  const skipped = props.sheets.filter((sheet) => !isImportable(sheet));

  return (
    <section>
      <p className="muted small">Файл: {props.fileName}</p>
      <h4>Какие разделы переносим</h4>

      {skipped.length > 0 && (
        <p className="small warn import-sheets-skipped">
          Переносить нечего в {skipped.length}{' '}
          {skipped.length === 1 ? 'листе' : 'листах'}: {skipped.map((sheet) => sheet.name).join(', ')}.
          Отметить их нельзя — под заголовками нет строк либо это не таблица учёта.
        </p>
      )}

      {usable.length === 0 ? (
        <p className="small warn">
          В этом файле нет ни одной таблицы с данными: на всех листах либо пусто, либо не найдена
          строка заголовков. Проверьте, тот ли это файл.
        </p>
      ) : (
        <p className="muted small">
          Колонки каждого раздела сопоставляются отдельно — по очереди, после этого шага.
        </p>
      )}

      {/*
        * Непригодные листы помечены значком, а не только серым текстом.
        *
        * Заказчик: «если строки в загруженном журнале пустые, нужно сразу
        * предупредить — как-то выделить это ещё на этапе выбора». Серая
        * приписка в конце строки этого не делает: её читают уже после того,
        * как не нашли лист в списке отмечаемых.
        */}
      <ul className="plain-list import-sheets">
        {props.sheets.map((sheet) => {
          const ok = isImportable(sheet);
          const badge = badgeOf(sheet);
          return (
            <li key={sheet.name} className={ok ? undefined : 'import-sheet-skipped'}>
              <label className={ok ? 'checkbox' : 'checkbox muted'}>
                <input
                  type="checkbox"
                  checked={props.selected.has(sheet.name)}
                  disabled={!ok}
                  onChange={() => props.onToggle(sheet.name)}
                />
                <span className="import-sheet-name">{sheet.name}</span>
                {badge !== null && <span className={`badge ${badge.kind}`}>{badge.text}</span>}
                <span className="muted small">{reason(sheet)}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button type="button" className="primary" disabled={chosen.length === 0} onClick={props.onNext}>
          Дальше: колонки{chosen.length > 1 ? ` (разделов: ${chosen.length})` : ''}
        </button>
      </div>
    </section>
  );
}
