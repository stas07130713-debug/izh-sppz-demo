/**
 * Библиотека элементов СППЗ — первый режим правой панели.
 *
 * Набор значков зависит от уровня: на генплане здания нет извещателей, а на
 * поэтажном плане нет гидрантов. Показывать всё подряд значит заставлять
 * пользователя выбирать из заведомо неподходящего.
 *
 * Элемент переносится на план перетаскиванием — так заводится один объект.
 * Правая кнопка по элементу открывает «Создать несколько» (часть 6.3): так
 * заводится партия однотипного оборудования с общими характеристиками и
 * схемой нумерации. Обратное перетаскивание — с плана сюда — снимает объект с
 * плана, не удаляя запись журнала.
 *
 * Список элементов живёт в ядре (element-catalog.ts): он же нужен журналу и
 * отчётам, и второй копии у него быть не должно.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, части 6.1–6.6.
 */

import { elementsFor, librarySections, type PlanKind } from '@izh/core';
import { ElementIcon } from './ElementIcon';

export interface ElementLibraryProps {
  readonly planKind: PlanKind;
  /** Объект, брошенный из плана в панель: снимается с плана. */
  readonly onDropObject: (objectId: string) => void;
  /** Правая кнопка по элементу: открыть «Создать несколько». */
  readonly onBatchCreate: (typeCode: string) => void;
}

export function ElementLibrary(props: ElementLibraryProps): React.JSX.Element {
  const items = elementsFor(props.planKind);

  if (items.length === 0) {
    return (
      <p className="muted small">
        Выберите здание, этаж или склад — набор элементов зависит от того, куда их наносить.
      </p>
    );
  }

  return (
    <div
      className="library"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData('text/plain');
        if (raw === '') return;
        const payload = JSON.parse(raw) as { kind?: string; id?: string };
        if (payload.kind === 'object' && typeof payload.id === 'string') props.onDropObject(payload.id);
      }}
    >
      <p className="muted small">
        {props.planKind === 'general'
          ? 'Набор для генплана объекта.'
          : props.planKind === 'storage'
            ? 'Набор для склада: лежать здесь может любое оборудование.'
            : 'Набор для поэтажного плана.'}
        {' '}
        Перетащите элемент на план. Обратное перетаскивание снимает объект с плана, запись в журнале остаётся.
      </p>

      {librarySections(items).map((group) => (
        <section key={group.section} className="library-section">
          <h5>{group.section}</h5>
          {group.note !== null && <p className="muted small library-section-note">{group.note}</p>}
          <ul className="library-list">
            {group.items.map((item) => (
              <li
                key={item.typeCode}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ kind: 'element', typeCode: item.typeCode }),
                  );
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                title="Перетащите на план. Правая кнопка — создать несколько сразу"
                onContextMenu={(event) => {
                  event.preventDefault();
                  props.onBatchCreate(item.typeCode);
                }}
              >
                <ElementIcon typeCode={item.typeCode} size="large" />
                <span className="library-code">{item.systemCode}</span>
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="library-note">
        Правая кнопка по элементу открывает окно «Создать несколько» — партия с общими характеристиками и
        схемой нумерации.
      </div>
    </div>
  );
}
