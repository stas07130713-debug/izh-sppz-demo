/**
 * Вкладка «Заявка» в настройках (ТЗ, Дополнение 6, часть С54).
 *
 * Заявка собирается по шагам, сверху вниз: раздел → система → элементы →
 * шаблон → выгрузка. Раньше она делалась кнопкой в карточке одного элемента —
 * то есть по одному элементу за раз, а подрядчику отдают список.
 *
 * Оформление документа общее с журналом: тот же вид таблицы, те же три формата.
 */

import { useMemo, useState } from 'react';
import type {
  AppSettings, JournalExportFormat, JournalExportRequest, MaintenanceEvent, PlanObject,
  RequestColumn, RequestTemplate, TreeNode,
} from '@izh/contracts';
import {
  DEFAULT_REQUEST_COLUMNS, DEFAULT_REQUEST_FOOTER, countBySystemKind, elementByCode,
  descendantsOf, journalScope, systemKindOf, worstObjectStatus,
} from '@izh/core';
import { todayIso } from '../today';
import { useScheduleSource } from '../schedule-source-context';
import { ElementIcon } from './ElementIcon';
import { GROUP_ORDER, GROUP_TITLES, byCatalogOrder, systemGroupOf, type SystemGroup } from './journal-groups';
import { RequestNodePicker } from './RequestNodePicker';
import { RequestObjectPicker } from './RequestObjectPicker';
import { RequestTemplateEditor } from './RequestTemplateEditor';
import { buildRequestExportRequest } from './request-export';

const EXPORT_FORMATS: readonly (readonly [JournalExportFormat, string])[] = [
  ['word', 'Word (.docx)'],
  ['pdf', 'PDF'],
  ['excel', 'Excel (.xlsx)'],
];

export interface RequestBuilderProps {
  readonly nodes: readonly TreeNode[];
  readonly node: TreeNode | null;
  readonly allObjects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly settings: AppSettings;
  readonly newId: () => string;
  readonly onSaveTemplate: (template: RequestTemplate) => void;
  readonly onDeleteTemplate: (id: string) => void;
  readonly onExport: (request: JournalExportRequest) => void;
}

export function RequestBuilder(props: RequestBuilderProps): React.JSX.Element {
  const scheduleSource = useScheduleSource();
  const today = todayIso();

  /**
   * Объекты, по которым составляется заявка.
   *
   * Заказчик: «привязку к выбранному в данный момент на дереве объекту делать
   * не нужно — пользователь внутри вкладки должен выбрать любой объект или
   * сразу несколько». Узел, выбранный в дереве, служит лишь начальной
   * отметкой: чаще всего заявку и составляют по тому, на что смотришь.
   */
  const [nodeIds, setNodeIds] = useState<ReadonlySet<string>>(
    () => new Set(props.node === null ? [] : [props.node.id]),
  );

  const [group, setGroup] = useState<SystemGroup | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [templateTitle, setTemplateTitle] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Заявка на техническое обслуживание');
  const [columns, setColumns] = useState<readonly RequestColumn[]>([...DEFAULT_REQUEST_COLUMNS]);
  const [footer, setFooter] = useState<readonly string[]>([...DEFAULT_REQUEST_FOOTER]);

  /*
   * Оборудование всех отмеченных узлов, без повторов.
   *
   * Отмеченный узел даёт и вложенные уровни, поэтому отметка здания и его
   * этажа разом ничего не удваивает: единица считается по одному разу.
   */
  const scope = useMemo(() => {
    const seen = new Set<string>();
    const all: PlanObject[] = [];
    for (const nodeId of nodeIds) {
      for (const object of journalScope(props.nodes, props.allObjects, nodeId)) {
        if (seen.has(object.id)) continue;
        seen.add(object.id);
        all.push(object);
      }
    }
    return all;
  }, [props.nodes, props.allObjects, nodeIds]);

  /*
   * Считается по видам систем, а не по подвидам.
   *
   * Заказчик: «заявка должна формироваться именно по виду системы, а не по
   * подразделам — целая заявка на огнетушители, а там может быть несколько
   * разделов, где отдельно углекислотные и отдельно порошковые». Так и
   * заказывают: подрядчику везут все огнетушители здания разом, а не тремя
   * заявками по зарядам.
   */
  const counts = useMemo(
    () => countBySystemKind(scope.map((object) => object.typeCode)),
    [scope],
  );

  const typesOfGroup = [...counts.keys()]
    .filter((code) => group === null || systemGroupOf(code) === group)
    .sort(byCatalogOrder);

  // В заявку идут все подвиды выбранного вида: выбрали огнетушители —
  // попадают и порошковые, и углекислотные.
  const objects = typeCode === null
    ? []
    : scope.filter((object) => systemKindOf(object.typeCode) === typeCode);

  /** Кто просрочен — по этому список поднимает строки наверх. */
  const overdueIds = useMemo(() => new Set(objects
    .filter((object) => worstObjectStatus(object, props.events, today, props.settings.soonThresholdDays, scheduleSource) === 'просрочено')
    .map((object) => object.id)),
  [objects, props.events, today, props.settings.soonThresholdDays, scheduleSource]);

  const chosen = objects.filter((object) => selected.has(object.id));
  const scopeTitle = typeCode === null ? 'Оборудование' : elementByCode(typeCode)?.title ?? typeCode;

  const template = (): RequestTemplate => ({
    id: props.newId(),
    title: templateTitle.trim() === '' ? `Шаблон: ${scopeTitle}` : templateTitle.trim(),
    documentTitle: documentTitle.trim() === '' ? 'Заявка' : documentTitle.trim(),
    typeCode,
    columns,
    footer,
    createdAt: new Date().toISOString(),
  });

  const applyTemplate = (saved: RequestTemplate): void => {
    setTemplateTitle(saved.title);
    setDocumentTitle(saved.documentTitle);
    setColumns(saved.columns);
    setFooter(saved.footer);
    if (saved.typeCode !== null && counts.has(saved.typeCode)) {
      setGroup(systemGroupOf(saved.typeCode));
      setTypeCode(saved.typeCode);
      setSelected(new Set());
    }
  };

  const exportRequest = (format: JournalExportFormat): void => {
    props.onExport(buildRequestExportRequest(format, {
      template: template(),
      objects: chosen,
      scopeTitle,
      context: {
        nodes: props.nodes,
        events: props.events,
        today,
        settings: props.settings,
        source: scheduleSource,
      },
    }));
  };

  const ready = chosen.length > 0 && columns.length > 0;


  return (
    <div className="request-builder">
      <section className="settings-section">
        <h4>1. Объекты</h4>
        <p className="muted small">
          Отметьте, по чему составляется заявка: любой узел или сразу несколько — здания, этажи,
          склады. Отмеченный узел даёт и всё, что в него входит; отметить здание и его этаж разом
          можно, оборудование не удвоится.
        </p>
        <RequestNodePicker
          nodes={props.nodes}
          selected={nodeIds}
          onToggle={(nodeId) => {
            /*
             * Отметка идёт вниз по дереву.
             *
             * Заказчик: «при проставлении галочки на верхнеуровневый объект
             * галочки должны автоматически проставляться на все объекты,
             * входящие в него по дереву». Оборудование и раньше бралось со
             * всего поддерева, но галочки внутри оставались пустыми — и по
             * списку выходило, что этажи не отмечены, хотя их оборудование в
             * заявку шло. Теперь видно то же, что и считается.
             */
            setNodeIds((current) => {
              const внутри = descendantsOf(props.nodes, nodeId).map((node) => node.id);
              const ветвь = [nodeId, ...внутри];
              const next = new Set(current);
              if (next.has(nodeId)) for (const id of ветвь) next.delete(id);
              else for (const id of ветвь) next.add(id);
              return next;
            });
            // Отбор ниже считается по другому набору оборудования: держать
            // прежние отметки значило бы отдать подрядчику чужие единицы.
            setSelected(new Set());
          }}
        />
        <p className="muted small">
          {nodeIds.size === 0
            ? 'Пока ничего не отмечено.'
            : `Отмечено объектов: ${nodeIds.size}. Оборудования в них: ${scope.length}.`}
        </p>
      </section>

      {props.settings.requestTemplates.length > 0 && (
        <section className="settings-section">
          <h4>Сохранённые шаблоны</h4>
          <ul className="plain-list">
            {props.settings.requestTemplates.map((saved) => (
              <li key={saved.id}>
                <button type="button" className="link" onClick={() => applyTemplate(saved)}>{saved.title}</button>
                <span className="muted small">
                  {' '}— граф: {saved.columns.length}
                  {saved.typeCode !== null && `, для «${elementByCode(saved.typeCode)?.title ?? saved.typeCode}»`}
                </span>
                <button
                  type="button" className="link danger"
                  onClick={() => props.onDeleteTemplate(saved.id)}
                >
                  {' '}удалить
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="settings-section">
        <h4>2. Раздел систем</h4>
        <div className="request-groups">
          <button
            type="button"
            className={group === null ? 'request-group active' : 'request-group'}
            onClick={() => { setGroup(null); setTypeCode(null); setSelected(new Set()); }}
          >
            Все разделы
          </button>
          {GROUP_ORDER.map((item) => (
            <button
              key={item}
              type="button"
              className={group === item ? `request-group group-${item} active` : `request-group group-${item}`}
              onClick={() => { setGroup(item); setTypeCode(null); setSelected(new Set()); }}
            >
              {GROUP_TITLES[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h4>3. Система</h4>
        {typesOfGroup.length === 0 ? (
          <p className="muted small">В этом разделе на выбранном узле оборудования нет.</p>
        ) : (
          <ul className="request-types">
            {typesOfGroup.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  className={code === typeCode ? 'request-type active' : 'request-type'}
                  onClick={() => { setTypeCode(code); setSelected(new Set()); }}
                >
                  <ElementIcon typeCode={code} />
                  <span>{elementByCode(code)?.title ?? code}</span>
                  <span className="muted small">{counts.get(code) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {typeCode !== null && (
        <section className="settings-section">
          <h4>4. Элементы</h4>
          <RequestObjectPicker
            objects={objects}
            nodes={props.nodes}
            events={props.events}
            overdueIds={overdueIds}
            selected={selected}
            onChange={setSelected}
          />
        </section>
      )}

      <section className="settings-section">
        <h4>5. Шаблон заявки</h4>
        <RequestTemplateEditor
          documentTitle={documentTitle}
          onDocumentTitleChange={setDocumentTitle}
          columns={columns}
          onColumnsChange={setColumns}
          footer={footer}
          onFooterChange={setFooter}
        />
      </section>

      <section className="settings-section">
        <h4>6. Сохранение и выгрузка</h4>
        <div className="field-row">
          <label className="field">
            <span>Название шаблона</span>
            <input
              value={templateTitle}
              placeholder={`Шаблон: ${scopeTitle}`}
              onChange={(event) => setTemplateTitle(event.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" disabled={columns.length === 0} onClick={() => props.onSaveTemplate(template())}>
              Сохранить шаблон
            </button>
          </div>
        </div>

        {!ready && (
          <p className="muted small">
            Чтобы выгрузить заявку, отметьте хотя бы один элемент и оставьте хотя бы одну графу.
          </p>
        )}

        <div className="actions">
          {EXPORT_FORMATS.map(([format, title]) => (
            <button key={format} type="button" className="primary" disabled={!ready} onClick={() => exportRequest(format)}>
              {title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
