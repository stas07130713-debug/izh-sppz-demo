/**
 * Соответствие огнетушителей требованиям — окно только для чтения (ТЗ,
 * часть П3.3; ППР РФ № 1479, пункт 409, приложения № 1 и 2).
 *
 * Окно отвечает на тот же вопрос, что и информационная справка «о соответствии
 * размещения первичных средств пожаротушения»: по каждому помещению — что
 * требуется, что стоит и чего не хватает.
 *
 * Нарушения и нехватка сведений разделены. «Ранг ниже требуемого» — вывод о
 * норме; «в карточке не заполнено назначение» — вывод о данных.
 *
 * Править отсюда нельзя ничего. Поля характеристик стояли прямо здесь, и
 * выходило, что сведения об объекте заводят из окна проверки, — а живут они
 * в карточке узла и в подготовке подложки. Теперь окно только называет
 * недостающее и ведёт туда, где его задают.
 */

import { useRef, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { JournalExportFormat, PlanObject } from '@izh/contracts';
import type { PlacementFinding, PlacementFix, PlacementReport, RoomPlacement } from '@izh/core';
import { useAnchoredMenu } from '../menu-placement';
import { SEVERITY_CLASS } from './check-severity';
import { CheckObjectList } from './CheckObjectList';

export interface ExtinguisherCheckModalProps {
  readonly report: PlacementReport;
  readonly busy: boolean;
  /** Выгрузка справки о размещении: Word, PDF или печать. */
  readonly onExport: (format: JournalExportFormat) => void;
  /**
   * Перейти туда, где недостающее задаётся.
   *
   * Сказать «не задан масштаб» и оставить человека искать, где он задаётся, —
   * половина дела. Кнопка стоит рядом с самим замечанием.
   */
  readonly onFix: (fix: PlacementFix, roomId: string) => void;
  readonly onShowObject: (object: PlanObject) => void;
  readonly onClose: () => void;
}

/** «1800» и «12,5»: до одного знака, и то лишь когда он есть. */
function formatArea(areaM2: number): string {
  return areaM2.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

const VERDICT_CLASS: Readonly<Record<string, string>> = {
  соответствует: 'ok',
  нарушение: 'danger',
  'нет данных': 'warn',
  'не требуется': 'muted',
};

/**
 * Форматы справки.
 *
 * Книги Excel здесь нет: справка — текстовый документ с приложением-схемой,
 * и раскладывать её по ячейкам не на что.
 */
const EXPORT_FORMATS: readonly (readonly [JournalExportFormat, string])[] = [
  ['word', 'Word (.doc)'],
  ['pdf', 'PDF'],
  ['print', 'Печать'],
];


/** Что предлагает кнопка правки. Пусто — правится не настройкой. */
const FIX_TITLES: Readonly<Record<PlacementFix, string>> = {
  масштаб: 'Задать масштаб плана',
  обводка: 'Обвести помещение на плане',
  здание: 'Открыть карточку здания',
  категория: 'Открыть карточку помещения',
  назначение: 'Открыть карточку помещения',
  классы: 'Открыть карточку помещения',
};

interface FindingsProps {
  readonly items: readonly PlacementFinding[];
  /** Куда вести по кнопке. Нет — вывод по уровню, помещение не при чём. */
  readonly roomId?: string;
  readonly onFix?: (fix: PlacementFix, roomId: string) => void;
  /** Открыть карточку объекта, о котором вывод. */
  readonly onOpenObject?: (objectId: string) => void;
}

function Findings(props: FindingsProps): React.JSX.Element | null {
  if (props.items.length === 0) return null;

  return (
    <ul className="check-findings">
      {props.items.map((finding, index) => (
        <li key={`${finding.text}-${index}`} className={SEVERITY_CLASS[finding.severity]}>
          {/* Первая строка — о чём речь: пометка и предмет. Вторая — что
              не так. Третья — пункт норматива. В одну строку это слипалось
              в «замечание28-10: …ППР РФ № 1479», где не видно ни границ, ни
              смысла. */}
          <div className="check-finding-head">
            <span className="check-severity">{finding.severity}</span>
            {finding.objectTitle !== undefined && (
              finding.objectId !== undefined && props.onOpenObject !== undefined ? (
                <button
                  type="button"
                  className="link check-finding-object"
                  title="Открыть карточку — там и заполняется недостающее"
                  onClick={() => props.onOpenObject?.(finding.objectId as string)}
                >
                  {finding.objectTitle}
                </button>
              ) : <span className="check-finding-object">{finding.objectTitle}</span>
            )}
          </div>

          <div className="check-finding-text">{finding.text}</div>

          <div className="check-finding-foot">
            <span className="muted small">{finding.clause}</span>
            {/* Кнопка ведёт туда, где недостающее задают. Править прямо здесь
                нельзя: сведения живут в карточке узла, а не в окне проверки. */}
            {finding.fix !== undefined && props.onFix !== undefined && (
              <button
                type="button"
                className="link"
                onClick={() => props.onFix?.(finding.fix as PlacementFix, props.roomId ?? '')}
              >
                {FIX_TITLES[finding.fix]}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Требование по помещению — то, что в справке идёт строкой «принимаются огнетушители не ниже…». */
function Requirement({ placement }: { readonly placement: RoomPlacement }): React.JSX.Element {
  const { requirement } = placement;

  if (!requirement.needed) {
    return <p className="muted small">Огнетушители не требуются: {requirement.exemption}</p>;
  }

  return (
    <dl className="check-requirement">
      <div>
        <dt>Требуемый ранг</dt>
        <dd>{requirement.rankText === '' ? 'не определён: не заданы классы пожара' : `не ниже ${requirement.rankText}`}</dd>
      </div>
      <div>
        <dt>Основание</dt>
        <dd>
          {requirement.rowBasis}
          {/*
            * Графы приложения № 1 дословно, по одной на класс пожара.
            *
            * Заказчик: «показывать как требуется согласно таблиц ППР». Без
            * этого сложенный ранг читался неверно: буква «С» приходит вместе
            * с классом E, где ранг так и напечатан — «55В, С, Е», — и
            * выглядела как требование класса С, которого в здании нет.
            */}
          {requirement.printedCells.length > 0 && (
            <ul className="plain-list check-printed">
              {requirement.printedCells.map((cell) => (
                <li key={cell.fireClass} className="muted small">
                  класс {cell.fireClass} — «{cell.asPrinted}»
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
      <div>
        <dt>Расстояние до огнетушителя</dt>
        <dd>{requirement.reachM === null ? 'не определено' : `не более ${requirement.reachM} м`}</dd>
      </div>

      {requirement.mobile !== null && (
        <div>
          <dt>Передвижные огнетушители</dt>
          <dd>
            {requirement.mobile.sets} комплектов на каждые {requirement.mobile.limitAreaM2} м²
            {requirement.halved && ' (уменьшено вдвое: помещение под АУП)'}
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Один раздел проверки: объект целиком или обведённое помещение.
 *
 * Заказчик: «вначале в целом по зданию... и дальше по каждому такому
 * помещению в схожем формате». Схожий формат — это буквально один и тот же
 * вид: разделы отличаются только заголовком и тем, откуда взята норма.
 */
function PlacementSection(props: {
  readonly placement: RoomPlacement;
  readonly onFix: (fix: PlacementFix, roomId: string) => void;
  readonly onShowObject: (object: PlanObject) => void;
}): React.JSX.Element {
  const { placement } = props;
  return (
    <section className={`check-room ${VERDICT_CLASS[placement.verdict] ?? ''}`}>
      <div className="check-room-head">
        <strong>{placement.roomName}</strong>
        <span className="muted small">
          {/* Площадь без лишних нулей: «1800 м²», а не «1800.00 м²» —
              сотые доли квадратного метра в норме ни на что не влияют. */}
          категория {placement.category ?? 'не задана'}
          {placement.areaM2 !== null && ` · ${formatArea(placement.areaM2)} м²`}
        </span>
        <span className={`badge ${VERDICT_CLASS[placement.verdict] ?? 'muted'}`}>{placement.verdict}</span>
      </div>

      <Requirement placement={placement} />
      {/*
        * Сверху — только выводы про сам раздел. То, что относится к
        * конкретному огнетушителю, показано в его строке ниже: иначе один и
        * тот же номер с одной и той же причиной читался дважды подряд.
        */}
      <Findings
        items={placement.findings.filter((finding) => finding.objectId === undefined)}
        roomId={placement.roomId}
        onFix={props.onFix}
        onOpenObject={(objectId) => {
          const object = placement.nearby.find((item) => item.object.id === objectId);
          if (object !== undefined) props.onShowObject(object.object);
        }}
      />

      <CheckObjectList
        items={placement.nearby}
        findings={placement.findings}
        onShowObject={props.onShowObject}
      />
    </section>
  );
}

export function ExtinguisherCheckModal(props: ExtinguisherCheckModalProps): React.JSX.Element {
  const { report } = props;
  const broken = report.rooms.filter((room) => room.verdict === 'нарушение').length;
  const incomplete = report.rooms.filter((room) => room.verdict === 'нет данных').length;
  const [formatsOpen, setFormatsOpen] = useState(false);
  /**
   * Список форматов держится своей кнопки и не уходит за край окна.
   *
   * Здесь это особенно важно: окно проверки само прокручивается, и список,
   * нарисованный внутри него, при прокрутке уезжал вместе с содержимым.
   */
  const formatsRef = useRef<HTMLDivElement>(null);
  const formatsButtonRef = useRef<HTMLButtonElement>(null);
  const formatsStyle = useAnchoredMenu(formatsRef, formatsButtonRef, formatsOpen);

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal check-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Соответствие видов огнетушителей</h3>

          {/* Справка выгружается по образцу заказчика — с характеристикой
              объекта, нормами, выводом и приложением-схемой из плана. */}
          <div className="journal-menu">
            <button
              ref={formatsButtonRef}
              type="button" className="primary" aria-expanded={formatsOpen}
              onClick={() => setFormatsOpen((open) => !open)}
            >
              ⭳ Скачать проверку ▾
            </button>
            {formatsOpen && (
              <>
                <div className="journal-menu-catch" onClick={() => setFormatsOpen(false)} />
                <div className="journal-menu-list" ref={formatsRef} style={formatsStyle}>
                  {EXPORT_FORMATS.map(([format, title]) => (
                    <button
                      key={format} type="button"
                      onClick={() => { setFormatsOpen(false); props.onExport(format); }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <div className="check-summary">
          <span className={`badge ${VERDICT_CLASS[report.verdict] ?? 'muted'}`}>{report.verdict}</span>
          <span className="muted small">
            Помещений: {report.rooms.length} · с нарушениями: {broken} · без полных сведений: {incomplete}
          </span>
          <span className="muted small">
            Огнетушителей: {report.total}, из них размещено на плане: {report.placed}
          </span>

        </div>

        <div className="check-body">
          {/* Выводы по этажу целиком: у них своего помещения нет,
              но перейти к настройке из них тоже нужно. */}
          <Findings items={report.findings} onFix={props.onFix} />

          {/*
            * Здесь ничего не правится. Окно отвечает на один вопрос: что не
            * соответствует требованиям и чего для ответа не хватает. Поля
            * характеристик стояли прямо тут, и выходило, что сведения об
            * объекте заводят из окна проверки — а живут они в карточке узла.
            * Теперь недостающее названо, и рядом ссылка туда, где его задают.
            */}

          {report.whole !== null && (
            <PlacementSection
              placement={report.whole}
              onFix={props.onFix}
              onShowObject={props.onShowObject}
            />
          )}

          {report.rooms.length === 0 ? (
            <p className="muted small">
              На этаже не заведено ни одного помещения. Обведите их в карточке узла и задайте
              категорию — тогда норма посчитается для каждого своя, а по обводке и масштабу
              проверится ещё и расстояние до огнетушителя.
            </p>
          ) : (
            report.rooms.map((placement) => (
              <PlacementSection
                key={placement.roomId}
                placement={placement}
                onFix={props.onFix}
                onShowObject={props.onShowObject}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
