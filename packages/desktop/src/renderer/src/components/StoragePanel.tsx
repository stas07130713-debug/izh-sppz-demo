/**
 * Склад СППЗ (ТЗ, часть 5.3; Дополнение 6, часть С81).
 *
 * У склада нет плана: координаты запасного огнетушителя на полке никому не
 * нужны, важен состав. Поэтому вместо подложки со значками — перечень того, что
 * на складе лежит.
 *
 * Склад разделён надвое, и это не украшение. В **резерве** лежит то, чем можно
 * заменить снятое: оно исправно и ждёт своего места. В **ремонте и на
 * обслуживании** — то, что снято и в работу пока не годится: сдано на
 * перезарядку, испытание, в мастерскую. Смешивать их нельзя: подменный
 * огнетушитель берут из резерва, и взять его из числа сданных в ремонт значит
 * повесить на стену пустой баллон.
 *
 * Полка — не техническое состояние. Исправный огнетушитель уезжает на плановую
 * перезарядку, а забракованный может лежать в резерве до списания: состояние
 * говорит, каков предмет, а полка — где он и чего ждёт.
 *
 * Состав и есть рабочая область склада: элемент, брошенный сюда из правой
 * панели, заводится без места установки и сразу попадает в журнал склада — та же
 * строгая связь журнала и графики, что и на плане.
 *
 * Сюда же заводится оборудование, числящееся за пожарной техникой: склад с
 * названием машины. Это исключение из правил структуры, а не отдельный вид узла.
 */

import { useEffect, useRef, useState } from 'react';
import type { MaintenanceEvent, PlanObject, StorageSection, TreeNode } from '@izh/contracts';
import { elementByCode, worstObjectStatus, type ScheduleStatus } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { todayIso } from '../today';
import { useScheduleSource } from '../schedule-source-context';
import type { PickMode } from './plan-selection';

export interface StoragePanelProps {
  readonly node: TreeNode;
  readonly objects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly soonThresholdDays: number;
  readonly selectedObjectId: string | null;
  /**
   * Счётчик «покажи ещё раз».
   *
   * Заказчик: «когда в журнале нажимаешь показать на плане, если
   * огнетушитель находится в складе, он почему-то не подсвечивается». На
   * поэтажном плане подсветку давал этот же счётчик, а склад его не
   * получал вовсе. Нужен именно счётчик, а не идентификатор: повторное
   * «показать» на том же элементе не меняет выбранного, и подсветка без
   * него не повторилась бы.
   */
  readonly focusTick: number;
  readonly onSelectObject: (objectId: string) => void;
  /** Общий с планом и журналом набор выделенного. */
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectMany: (objectIds: readonly string[], mode: PickMode) => void;
  /** Элемент, брошенный в окно склада: заводится без места установки. */
  readonly onPlaceElement: (typeCode: string, position: null) => void;
  /** Переложить объект на другую полку. */
  readonly onSetSection: (objectId: string, section: StorageSection) => void;
  /** Правая кнопка по единице: то же меню, что и на плане. */
  readonly onContextMenu: (object: PlanObject, screenPosition: { x: number; y: number }) => void;
}

const SECTION_TITLES: Readonly<Record<StorageSection, string>> = {
  резерв: 'Резерв',
  ремонт: 'В ремонте и на обслуживании',
};

const SECTIONS: readonly { readonly section: StorageSection; readonly hint: string }[] = [
  { section: 'резерв', hint: 'Исправное оборудование, готовое встать на место снятого.' },
  { section: 'ремонт', hint: 'Снято с места: перезарядка, испытание, ремонт. В работу пока не годится.' },
];

/** Пустая полка у старых записей читается как резерв: так лежали все до разделения. */
function sectionOf(object: PlanObject): StorageSection {
  return object.storageSection === 'ремонт' ? 'ремонт' : 'резерв';
}

export function StoragePanel(props: StoragePanelProps): React.JSX.Element {
  // Регламент организации, а где его нет — нормативная библиотека (Дополнение 5, Р19).
  const scheduleSource = useScheduleSource();
  const [over, setOver] = useState<StorageSection | null>(null);
  const today = todayIso();
  const shownTick = useRef(-1);

  const worstStatus = (object: PlanObject): ScheduleStatus =>
    worstObjectStatus(object, props.events, today, props.soonThresholdDays, scheduleSource);

  /**
   * Брошенное на полку: новый элемент из библиотеки или объект с другой полки.
   *
   * Оба случая здесь, а не в двух обработчиках: для человека это одно движение —
   * «положить сюда», — и разводить его по двум путям незачем.
   */
  const drop = (section: StorageSection) => (event: React.DragEvent): void => {
    event.preventDefault();
    setOver(null);

    const raw = event.dataTransfer.getData('text/plain');
    if (raw === '') return;
    const payload = JSON.parse(raw) as { kind?: string; typeCode?: string; id?: string };

    if (payload.kind === 'element' && typeof payload.typeCode === 'string') {
      props.onPlaceElement(payload.typeCode, null);
      return;
    }
    if (payload.kind === 'object' && typeof payload.id === 'string') {
      props.onSetSection(payload.id, section);
    }
  };

  /*
   * Пришли «показать на плане» — подводим к единице и подсвечиваем.
   *
   * Список склада прокручивается, и в длинном складе выбранная единица
   * оказывается за пределами видимого: без прокрутки подсветка была бы
   * там, куда человек не смотрит.
   */
  useEffect(() => {
    if (props.focusTick === shownTick.current || props.selectedObjectId === null) return;
    const item = document.querySelector<HTMLButtonElement>(
      `[data-storage-object-id="${props.selectedObjectId}"]`,
    );
    if (item === null) return;
    shownTick.current = props.focusTick;
    item.classList.remove('flash');
    void item.offsetWidth;
    item.classList.add('flash');
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [props.selectedObjectId, props.focusTick, props.objects.length]);

  return (
    <div
      className="storage-panel"
      onClick={(event) => {
        // Щелчок мимо единиц снимает набор — как на плане и в журнале.
        if (event.ctrlKey || event.metaKey) return;
        if (props.selectedIds.size > 0) props.onSelectMany([], 'replace');
      }}
    >
      <div className="plan-hint muted">
        Склад «{props.node.name}»: {props.objects.length === 0 ? 'пока пусто' : `единиц оборудования — ${props.objects.length}`}.
        Перетащите элемент из правой панели, чтобы поставить его на приход, — запись в журнале появится сразу.
        Между полками оборудование перетаскивается мышью.
      </div>

      <div className="storage-sections">
        {SECTIONS.map(({ section, hint }) => {
          // Однотипное рядом: на складе ищут «где огнетушители», а не
          // конкретный номер, и вперемешку список читать нельзя.
          const items = props.objects
            .filter((object) => sectionOf(object) === section)
            .slice()
            .sort((a, b) => a.typeCode.localeCompare(b.typeCode, 'ru')
              || (a.regNumber ?? '').localeCompare(b.regNumber ?? '', 'ru'));
          const other: StorageSection = section === 'резерв' ? 'ремонт' : 'резерв';

          return (
            <section
              key={section}
              className={['storage-section', `storage-section-${section}`, over === section ? 'over' : '']
                .join(' ').trim()}
              onDragOver={(event) => { event.preventDefault(); setOver(section); }}
              onDragLeave={() => setOver((current) => (current === section ? null : current))}
              onDrop={drop(section)}
            >
              <div className="storage-section-head">
                <h3>{SECTION_TITLES[section]}</h3>
                <span className="muted small">{items.length} шт.</span>
              </div>
              <p className="muted small">{hint}</p>

              {items.length === 0 ? (
                <p className="muted small storage-section-empty">Пусто. Перетащите оборудование сюда.</p>
              ) : (
                <ul className="storage-list">
                  {items.map((object) => (
                    <li key={object.id}>
                      <button
                        type="button"
                        data-storage-object-id={object.id}
                        className={[
                          'storage-item',
                          `marker-${statusClass(worstStatus(object))}`,
                          object.id === props.selectedObjectId ? 'selected' : '',
                          props.selectedIds.has(object.id) ? 'picked' : '',
                        ].join(' ').trim()}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'object', id: object.id }));
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={(event) => {
                          // Ctrl набирает группу — так же, как на плане и в журнале.
                          if (event.ctrlKey || event.metaKey) props.onSelectMany([object.id], 'toggle');
                          else props.onSelectObject(object.id);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          props.onContextMenu(object, { x: event.clientX, y: event.clientY });
                        }}
                        title={`${object.model ?? elementByCode(object.typeCode)?.title ?? object.typeCode} — ${worstStatus(object)}`}
                      >
                        <ElementIcon typeCode={object.typeCode} />
                        <span className="small">{object.regNumber ?? '(без номера)'}</span>
                      </button>

                      {/* Кнопка рядом с перетаскиванием: мышью тащить удобно не
                          всем и не всегда, а полок всего две. */}
                      <button
                        type="button"
                        className="link storage-move"
                        title={`Переложить в «${SECTION_TITLES[other]}»`}
                        onClick={() => props.onSetSection(object.id, other)}
                      >
                        {other === 'резерв' ? '↩ в резерв' : '→ в ремонт'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function statusClass(status: ScheduleStatus): string {
  if (status === 'норма') return 'ok';
  if (status === 'скоро') return 'warn';
  if (status === 'просрочено') return 'danger';
  return 'unknown';
}
