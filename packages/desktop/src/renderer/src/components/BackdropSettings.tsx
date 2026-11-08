/**
 * Подложки планов в настройках: что загружено и в каком масштабе.
 *
 * Масштаб спрашивается один раз — там, где он впервые понадобился, то есть при
 * проверке расстановки. Дальше он закреплён за подложкой, и менять его посреди
 * работы с планом незачем: это редкое действие, у которого есть цена — круги
 * нормы и все расстояния считаются заново.
 *
 * Поэтому его место здесь, в настройках: раздел собирает все подложки объекта
 * в один список, где видно, у какой масштаб задан, а у какой нет.
 */

export interface BackdropRow {
  readonly backdropId: string;
  /** Узел, которому подложка принадлежит: правки идут на его плане. */
  readonly nodeId: string;
  /** Название узла, к которому привязана подложка: «1 этаж». */
  readonly nodeTitle: string;
  /** Путь от организации: «АО «Кольская ГМК» · АСС · МВАСО · 1 этаж». */
  readonly nodePath: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Метров в одной точке чертежа. null — масштаб не задан. */
  readonly metersPerPixel: number | null;
}

export interface BackdropSettingsProps {
  readonly rows: readonly BackdropRow[];
  /** Открыть узел подложки и задать её масштаб. */
  readonly onSetScale: (row: BackdropRow) => void;
  /**
   * Открыть правку чертежа: поворот, обрезка, стирание лишнего.
   *
   * Правка живёт на отдельном экране подготовки подложки — там же, где
   * чертёж принимают. Второго такого места заводить незачем: правки
   * неразрушающие и считаются от исходного файла, а он лежит там.
   */
  readonly onEdit: (row: BackdropRow) => void;
  /**
   * Загрузить на место этой подложки другой файл.
   *
   * Прежняя остаётся в хранилище: планы перевыпускают, и сравнить новый
   * чертёж со старым бывает нужно. Работа идёт с последним загруженным.
   */
  readonly onReplace: (row: BackdropRow) => void;
}

/**
 * Строки, разложенные деревом объекта.
 *
 * Заказчик: «когда выбираешь объект, например 1 этаж, непонятно, к какому
 * зданию он относится; должна быть такая же разбивка по дереву объектов —
 * сделай наглядно, как в дереве, сейчас просто список».
 *
 * И правда: этажей «1 этаж» на предприятии столько же, сколько зданий, и
 * список из одинаковых названий с путём мелкой строкой рядом читать нельзя.
 * Порядок и вложенность берутся из самого пути: он приходит готовым,
 * собранным от организации, и второго источника иерархии здесь не нужно.
 */
interface BackdropGroup {
  /** Только родительский путь; название самого плана сюда не повторяется. */
  readonly parents: readonly string[];
  readonly rows: readonly BackdropRow[];
}

const PATH_SEPARATOR = ' · ';

function sameTitle(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('ru') === b.trim().toLocaleLowerCase('ru');
}

export function backdropGroups(rows: readonly BackdropRow[]): readonly BackdropGroup[] {
  const sorted = [...rows].sort((a, b) => a.nodePath.localeCompare(b.nodePath, 'ru'));
  const groups = new Map<string, { parents: readonly string[]; rows: BackdropRow[] }>();

  for (const row of sorted) {
    // Старые данные иногда содержат соседние одинаковые уровни («Здание ·
    // Здание»). В интерфейсе это не два разных объекта, а дубль пути.
    const parts = row.nodePath.split(PATH_SEPARATOR).map((part) => part.trim()).filter(Boolean)
      .filter((part, index, all) => index === 0 || !sameTitle(part, all[index - 1] ?? ''));
    const parents = [...parts];
    if (sameTitle(parents[parents.length - 1] ?? '', row.nodeTitle)) parents.pop();

    const key = parents.map((part) => part.toLocaleLowerCase('ru')).join('\u0000');
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { parents, rows: [row] });
    } else {
      existing.rows.push(row);
    }
  }

  return [...groups.values()];
}

/** «5 см в точке» читается человеком, а «0.05 м/пкс» — нет. */
function scaleText(metersPerPixel: number | null): string {
  if (metersPerPixel === null) return 'масштаб не задан';
  const cm = metersPerPixel * 100;
  return `${cm < 10 ? cm.toFixed(1) : Math.round(cm)} см в точке`;
}

export function BackdropSettings(props: BackdropSettingsProps): React.JSX.Element {
  return (
    <section className="settings-section">
      <h4>Подложки планов</h4>
      <p className="muted small">
        Масштаб, правка чертежа и замена файла подложки.
      </p>

      {props.rows.length === 0 ? (
        <p className="muted small">Подложек пока нет: загрузите чертёж этажа во вкладке «План».</p>
      ) : (
        <ul className="backdrop-rows backdrop-tree">
          {backdropGroups(props.rows).map((group) => (
            <li key={group.parents.join(PATH_SEPARATOR)} className="backdrop-tree-group">
              <div className="backdrop-tree-path" aria-label={`Расположение: ${group.parents.join(', ')}`}>
                <span className="backdrop-tree-icon backdrop-tree-icon-node" aria-hidden="true">▦</span>
                {group.parents.length === 0 ? (
                  <strong className="small">Корень объекта</strong>
                ) : group.parents.map((part, index) => (
                  <span key={`${index}:${part}`} className="backdrop-path-part">
                    {index > 0 && <span className="backdrop-path-arrow" aria-hidden="true">›</span>}
                    <span className={index === group.parents.length - 1 ? 'small backdrop-path-current' : 'small muted'}>
                      {part}
                    </span>
                  </span>
                ))}
              </div>

              <ul className="backdrop-tree-plans">
                {group.rows.map((row) => (
                  <li key={row.backdropId} className="backdrop-tree-plan">
                    <span className="backdrop-row-name">
                      <span className="backdrop-tree-icon backdrop-tree-icon-plan" aria-hidden="true">▤</span>
                      <strong className="small">{row.nodeTitle}</strong>
                    </span>
                    <span className="muted small">{row.widthPx} × {row.heightPx} точек</span>
                    <span className={row.metersPerPixel === null ? 'badge warn' : 'muted small'}>
                      {scaleText(row.metersPerPixel)}
                    </span>
                    <span className="backdrop-row-actions">
                      <button type="button" className="link" onClick={() => props.onSetScale(row)}>
                        {row.metersPerPixel === null ? 'задать масштаб' : 'изменить масштаб'}
                      </button>
                      <button type="button" className="link" onClick={() => props.onEdit(row)}>
                        редактировать чертёж
                      </button>
                      <button type="button" className="link" onClick={() => props.onReplace(row)}>
                        загрузить другой файл
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
