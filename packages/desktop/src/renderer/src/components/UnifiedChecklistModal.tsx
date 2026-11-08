import { useRef, useMemo, useState } from 'react';
import type {
  AppSettings, ChecklistAnswer, ChecklistItemResult, ExternalMaintenanceEvidence, InspectionAct, MaintenanceExecutor,
  MaintenanceMeasurement, MaintenanceResult, PlanObject,
} from '@izh/contracts';
import { backdropClose } from './modal-backdrop';
import { checkGroupTitle, elementByCode, type ActivityCell, type ActivityChecklistItem } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { DueBadge } from './due-badge';
import { groupChecklistCells } from './checklist-groups';
import { todayIso } from '../today';
import {
  evidenceErrors, executorFrom, externalEvidenceFrom, MaintenanceEvidenceFields,
  type MaintenanceEvidenceState,
} from './MaintenanceEvidenceFields';
import { ExtinguisherMeasurementFields, measurementsFrom } from './ExtinguisherMeasurementFields';
import {
  EMPTY_INSPECTION_ACT, InspectionActFields, inspectionActErrors, inspectionActFrom,
  type InspectionActState,
} from './InspectionActFields';
import { SelectField } from './SelectField';

const ITEM_RESULTS: readonly ChecklistItemResult[] = [
  'не проверено', 'выполнено', 'выполнено с замечанием', 'не выполнено', 'не применяется',
];

export interface ChecklistSubmission {
  readonly activityCode: string;
  readonly checklist: readonly ChecklistAnswer[];
  readonly result: MaintenanceResult;
  readonly defect: string | null;
}

export interface UnifiedChecklistFields {
  readonly objectIds: readonly string[];
  readonly performedOn: string;
  readonly executor: string | null;
  readonly executorDetails: MaintenanceExecutor | null;
  readonly externalEvidence: ExternalMaintenanceEvidence | null;
  readonly inspectionAct: InspectionAct | null;
  readonly measurements: readonly MaintenanceMeasurement[];
  readonly note: string | null;
  readonly entries: readonly ChecklistSubmission[];
  /**
   * Пароль для простой электронной подписи. `null` — вносят без подписи.
   *
   * Пароль спрашивается заново в момент подписания, а не берётся из входа:
   * по 63-ФЗ (статья 5 часть 2) подпись подтверждается «посредством
   * использования кодов, паролей», и пароль, введённый утром при входе,
   * подтверждает вход, а не подпись.
   */
  readonly password: string | null;
}

interface Props {
  readonly object: PlanObject;
  readonly candidates: readonly PlanObject[];
  /**
   * Работы со сроками для любого элемента группы.
   *
   * Функция, а не готовый список: система проверяется целиком, а регламенты
   * внутри неё разные — у прибора свои работы, у извещателя свои. Раньше сюда
   * приходили работы одного элемента, и на остальных они не распространялись:
   * запись отклонялась как неприменимая, а до отказа этого было не видно.
   */
  readonly cellsFor: (object: PlanObject) => readonly ActivityCell[];
  readonly initialActivityCode: string | null;
  readonly busy: boolean;
  readonly settings: AppSettings;
  /**
   * Кто заполняет чек-лист.
   *
   * ФИО и должность подставляются исполнителем работ: чаще всего проверку
   * проводит тот, кто её и записывает, и переписывать своё имя каждый раз —
   * лишняя работа. Поле остаётся обычным: работу нередко выполняет
   * подрядчик или сменщик, а запись вносит ответственный.
   */
  readonly performer: {
    readonly fullName: string;
    readonly position: string | null;
    readonly organization?: string | null;
  } | null;
  /**
   * Организация исполнителя — название верхнего узла дерева.
   *
   * Заказчик: «графа организация также заполняется автоматически, берётся
   * из названия организации, которая активна по дереву объектов». Своя
   * проверка проводится своими силами, и набирать название предприятия
   * при каждом чек-листе незачем. Поле остаётся исправимым вручную.
   */
  readonly organization: string | null;
  readonly onClose: () => void;
  /** `null` — запись завершена; строка — ошибка подписи, которую показывают у пароля. */
  readonly onSubmit: (fields: UnifiedChecklistFields) => Promise<string | null>;
  /** Вправе ли этот человек подписывать: гость и временный пароль — нет. */
  readonly canSign: boolean;
}

interface AnswerState { readonly result: ChecklistItemResult; readonly defect: string; readonly attachments: readonly import('@izh/contracts').StoredDocumentReference[]; }
interface ExternalResultState { readonly result: MaintenanceResult; readonly defect: string; }
const EXTERNAL_RESULTS: readonly MaintenanceResult[] = ['выполнено', 'выполнено с замечаниями', 'не выполнено'];

const EMPTY_EVIDENCE: MaintenanceEvidenceState = {
  external: false, fullName: '', position: '', executorOrganization: '', externalOrganization: '',
  inn: '', licenseNumber: '', actNumber: '', actDate: '', actFile: null,
};

function key(activityCode: string, index: number): string { return `${activityCode}::${index}`; }
function itemText(item: string | ActivityChecklistItem): string { return typeof item === 'string' ? item : item.text; }
function itemSeverity(item: string | ActivityChecklistItem): ActivityChecklistItem['severity'] | undefined {
  return typeof item === 'string' ? undefined : item.severity;
}

export function UnifiedChecklistModal(props: Props): React.JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set(props.initialActivityCode === null ? [] : [props.initialActivityCode]),
  );
  const [objectIds, setObjectIds] = useState<ReadonlySet<string>>(new Set([props.object.id]));

  const cellsByObject = useMemo(
    () => new Map(props.candidates.map((object) => [object.id, props.cellsFor(object)])),
    [props.candidates, props.cellsFor],
  );

  /**
   * Работы, применимые к отмеченным элементам.
   *
   * Объединение, а не пересечение: отметив прибор и его извещатели, человек
   * должен увидеть работы и того, и других — и выбрать, что закрывает. Рядом с
   * работой сказано, скольких отмеченных она касается; в журнал она попадёт
   * только тем, к кому применима.
   */
  const cells = useMemo(() => {
    const byCode = new Map<string, { cell: ActivityCell; count: number }>();
    for (const object of props.candidates) {
      if (!objectIds.has(object.id)) continue;
      for (const cell of cellsByObject.get(object.id) ?? []) {
        const known = byCode.get(cell.rule.activityCode);
        byCode.set(cell.rule.activityCode, known === undefined
          ? { cell, count: 1 }
          : { cell: moreUrgent(known.cell, cell), count: known.count + 1 });
      }
    }
    return byCode;
  }, [props.candidates, objectIds, cellsByObject]);

  const cellList = [...cells.values()].map((item) => item.cell);
  const rules = cellList.map((cell) => cell.rule);
  /** Скольких отмеченных элементов касается работа — подпись рядом с ней. */
  const coverage = (activityCode: string): number => cells.get(activityCode)?.count ?? 0;
  /**
   * Разные ли виды в группе.
   *
   * У прибора приёмно-контрольного в группе вся его система, а в ней
   * извещатели, оповещатели и модули сразу: один учётный номер без вида не
   * говорит, что именно отмечают.
   */
  const mixedTypes = new Set(props.candidates.map((object) => object.typeCode)).size > 1;
  const [act, setAct] = useState<InspectionActState>(EMPTY_INSPECTION_ACT);
  const [performedOn, setPerformedOn] = useState(todayIso());
  const [evidence, setEvidence] = useState<MaintenanceEvidenceState>({
    ...EMPTY_EVIDENCE,
    fullName: props.performer?.fullName ?? '',
    position: props.performer?.position ?? '',
    /*
     * Организация исполнителя — из его учётной записи, а не из дерева объекта.
     *
     * Заказчик: «эта информация подставляется в соответствующие графы при
     * проверке оборудования». Дерево отвечает на вопрос «чьё оборудование», а
     * в акте нужна организация того, кто проверял: подрядчик по договору
     * работает в своей. Пока в карточке человека организация не указана,
     * подставляется организация объекта — так было и раньше, и для штатного
     * инженера это чаще всего верно.
     */
    executorOrganization: props.performer?.organization ?? props.organization ?? '',
  });
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Пароль для подписи. Живёт только в окне и никуда не сохраняется. */
  const [password, setPassword] = useState('');
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ReadonlyMap<string, AnswerState>>(new Map());
  const [externalResults, setExternalResults] = useState<ReadonlyMap<string, ExternalResultState>>(new Map());
  const [measurementValues, setMeasurementValues] = useState<ReadonlyMap<string, string>>(new Map());

  const selectedRules = rules.filter((rule) => selected.has(rule.activityCode));
  const answerFor = (code: string, index: number): AnswerState =>
    answers.get(key(code, index)) ?? { result: 'не проверено', defect: '', attachments: [] };
  const setAnswer = (code: string, index: number, value: AnswerState): void => setAnswers((current) => {
    const next = new Map(current); next.set(key(code, index), value); return next;
  });
  const toggle = (current: ReadonlySet<string>, value: string): ReadonlySet<string> => {
    const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next;
  };

  const incomplete = selectedRules.flatMap((rule) => rule.checklist.flatMap((item, index) => {
    const answer = answerFor(rule.activityCode, index);
    if (answer.result === 'не проверено') return [`Не отмечен пункт «${itemText(item)}»`];
    if ((answer.result === 'не выполнено' || answer.result === 'выполнено с замечанием') && answer.defect.trim() === '') {
      return [`Не описан результат пункта «${itemText(item)}»`];
    }
    return [];
  }));
  const externalIncomplete = selectedRules.flatMap((rule) => {
    const value = externalResults.get(rule.activityCode) ?? { result: 'выполнено', defect: '' };
    return value.result !== 'выполнено' && value.defect.trim() === '' ? [`Опишите результат «${rule.title}»`] : [];
  });
  const errors = [
    ...(selectedRules.length === 0 ? ['Не выбран вид проверки'] : []),
    ...(objectIds.size === 0 ? ['Не выбран огнетушитель'] : []),
    ...(performedOn === '' ? ['Не указана дата'] : []),
    ...(performedOn > todayIso() ? ['Дата выполнения ещё не наступила'] : []),
    ...(evidence.external ? externalIncomplete : incomplete), ...evidenceErrors(evidence),
    ...inspectionActErrors(act),
  ];
  /** Нужен ли акт: признак стоит у правила, в данных (Дополнение 6). */
  const actNeeded = selectedRules.some((rule) => rule.needsAct === true);

  const submit = (signing: boolean): void => {
    if (errors.length > 0) return;
    const entries = selectedRules.map((rule): ChecklistSubmission => {
      if (evidence.external) {
        const external = externalResults.get(rule.activityCode) ?? { result: 'выполнено', defect: '' };
        const itemResult: ChecklistItemResult = external.result === 'выполнено с замечаниями'
          ? 'выполнено с замечанием' : external.result;
        const defect = external.result === 'выполнено' ? null : external.defect.trim();
        return {
          activityCode: rule.activityCode, result: external.result, defect,
          checklist: [{ item: `Результат по акту: ${rule.title}`, result: itemResult, defect, evidenceSource: 'акт' }],
        };
      }
      const checklist = rule.checklist.map((item, index): ChecklistAnswer => {
        const answer = answerFor(rule.activityCode, index);
        return {
          item: itemText(item), result: answer.result, severity: itemSeverity(item),
          defect: answer.result === 'выполнено' || answer.result === 'не применяется' ? null : answer.defect.trim(),
          attachments: answer.attachments,
          evidenceSource: evidence.external ? 'акт' : 'осмотр',
        };
      });
      const result: MaintenanceResult = checklist.some((item) => item.result === 'не выполнено')
        ? 'не выполнено'
        : checklist.some((item) => item.result === 'выполнено с замечанием')
          ? 'выполнено с замечаниями' : 'выполнено';
      const defects = checklist.filter((item) => item.defect !== null).map((item) => `${item.item}: ${item.defect}`);
      return { activityCode: rule.activityCode, checklist, result, defect: defects.length === 0 ? null : defects.join('; ') };
    });
    const executor = executorFrom(evidence);
    setSignatureError(null);
    void props.onSubmit({
      objectIds: [...objectIds], performedOn, executor: executor?.fullName ?? null,
      executorDetails: executor, externalEvidence: externalEvidenceFrom(evidence),
      inspectionAct: inspectionActFrom(act),
      measurements: evidence.external ? [] : measurementsFrom(props.object.typeCode, measurementValues),
      note: note.trim() === '' ? null : note.trim(), entries,
      password: signing ? password : null,
    }).then(setSignatureError);
  };

  return <div className="modal-backdrop" {...backdropClose(props.onClose)}>
    <div className="modal checklist-modal" onClick={(event) => event.stopPropagation()}>
      <div className="panel-head"><h3 className="titled-with-icon">
          <ElementIcon typeCode={props.object.typeCode} />
          <span>Чек-лист — {elementByCode(props.object.typeCode)?.title ?? props.object.typeCode}</span>
        </h3>
        <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button></div>
      {/* Смешанная группа: у прибора приёмно-контрольного в списке вся его
          система, а в ней извещатели, оповещатели и модули сразу. */}
      {/* Будущим числом проверка не записывается: журнал ведёт сделанное, а
          не запланированное. Ограничение стоит и здесь, и в ядре — поле не
          даёт выбрать, ядро не даёт записать в обход поля. */}
      <label className="field"><span>Дата выполнения</span>
        <input type="date" max={todayIso()} value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} /></label>
      {/* Блок появляется, только когда закрывать одной проверкой действительно
          есть что. У гидранта или лестницы группы нет. */}
      {props.candidates.length > 1 && <details className="batch-picker">
        <summary>{checkGroupTitle(props.object, elementByCode(props.object.typeCode)?.title ?? props.object.typeCode)} ({objectIds.size} из {props.candidates.length})</summary>
        <p className="muted small">Отметьте элементы, которые проверены этим же визитом. Запись в журнал ляжет каждому отмеченному.</p>
        <div className="work-kinds">{props.candidates.map((object) => <label className="checkbox" key={object.id}>
          <input type="checkbox" checked={objectIds.has(object.id)} onChange={() => setObjectIds((v) => toggle(v, object.id))} />
          {/* Вид указывается, когда в группе разные виды: у прибора
              приёмно-контрольного в списке вся система, и один номер без
              вида не говорит, извещатель это или оповещатель. */}
          <span>{mixedTypes && `${elementByCode(object.typeCode)?.title ?? object.typeCode} `}{object.regNumber ?? '(без номера)'}{object.model === null ? '' : ` — ${object.model}`}</span>
        </label>)}</div>
      </details>}
      <MaintenanceEvidenceFields value={evidence} onChange={setEvidence} onError={setError} />
      {actNeeded && <InspectionActFields value={act} onChange={setAct} onError={setError} />}

      {/* Работы разложены по срокам обслуживания — так же, как в настройках:
          «Ежемесячно», «Раз в полгода», а внутри уже осмотр, перекатка,
          испытание. Плоский список заставлял сверять его с настройками
          глазами и гадать, к какому сроку относится работа. */}
      <section className="checklist-periodicity">
        <h4>Что проверяется</h4>
        {cellList.length === 0 ? (
          <p className="muted small">Для этого оборудования регламент не задан — проверять нечего.</p>
        ) : groupChecklistCells(cellList).map((group) => (
          <section key={group.title} className="periodicity-group">
            <div className="periodicity-group-head">
              {/* Галочка стоит у самого срока: проверяющий закрывает срок, а не
                  отдельную работу. Внутри срока работы отмечаются по одной,
                  когда их несколько. */}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={group.cells.every((item) => selected.has(item.rule.activityCode))}
                  onChange={(event) => setSelected((current) => {
                    const next = new Set(current);
                    for (const item of group.cells) {
                      if (event.target.checked) next.add(item.rule.activityCode);
                      else next.delete(item.rule.activityCode);
                    }
                    return next;
                  })}
                />
                <h5>{group.title}</h5>
              </label>
              {/* К скольким отмеченным элементам относится работа. Пишется
                  только когда отмечен не один: у прибора и его извещателей
                  регламенты разные, и без этой подписи непонятно, кому именно
                  запишется проверка. */}
              {objectIds.size > 1 && (
                <span className="muted small work-coverage">
                  относится к {coverage(group.cells[0]?.rule.activityCode ?? '')} из {objectIds.size}
                </span>
              )}
              {/* Срок группы — по самой срочной её работе: если что-то внутри
                  просрочено, группа обязана гореть красным целиком. */}
              <DueBadge schedule={urgentOf(group.cells).schedule} />
            </div>

            {group.cells.map((cell) => {
              const rule = cell.rule;
              const picked = selected.has(rule.activityCode);
              const external = externalResults.get(rule.activityCode) ?? { result: 'выполнено' as MaintenanceResult, defect: '' };

              return <section key={rule.activityCode} className={picked ? 'periodicity-block picked' : 'periodicity-block'}>
                {/* Когда работа в сроке одна, её галочка совпадала бы с галочкой
                    самого срока — второй ряд был бы лишним. */}
                {group.cells.length > 1 && <div className="periodicity-head">
                  <label className="checkbox">
                    <input type="checkbox" checked={picked} onChange={() => setSelected((v) => toggle(v, rule.activityCode))} />
                    <span className="small"><strong>{rule.title}</strong></span>
                  </label>
                  <DueBadge schedule={cell.schedule} />
                </div>}

                {picked && evidence.external && <div className="external-result-row">
                  <SelectField
                    value={external.result}
                    options={EXTERNAL_RESULTS.map((result) => ({ value: result, title: result }))}
                    onChange={(value) => setExternalResults((current) => {
                      const next = new Map(current);
                      next.set(rule.activityCode, { ...external, result: value as MaintenanceResult });
                      return next;
                    })}
                  />
                  {external.result !== 'выполнено' && <input value={external.defect} placeholder="Результат или замечание по акту" onChange={(event) => setExternalResults((current) => {
                    const next = new Map(current); next.set(rule.activityCode, { ...external, defect: event.target.value }); return next;
                  })} />}
                </div>}

                {picked && !evidence.external && <ul className="checklist-items">{rule.checklist.map((item, index) => {
                  const answer = answerFor(rule.activityCode, index);
                  return <li key={key(rule.activityCode, index)} className={`checklist-item ${answer.result === 'выполнено' ? 'done' : ''}`}>
                    <span className="checklist-item-text">{itemText(item)}</span>
                    <SelectField
                      value={answer.result}
                      options={ITEM_RESULTS.map((option) => ({ value: option, title: option }))}
                      onChange={(value) =>
                        setAnswer(rule.activityCode, index, { ...answer, result: value as ChecklistItemResult })}
                    />
                    {(answer.result === 'не выполнено' || answer.result === 'выполнено с замечанием') &&
                      <><input className="checklist-defect" value={answer.defect} placeholder="Опишите замечание или дефект" onChange={(e) => setAnswer(rule.activityCode, index, { ...answer, defect: e.target.value })} />
                      <ChecklistAttachments value={answer.attachments} onChange={(attachments) => setAnswer(rule.activityCode, index, { ...answer, attachments })} onError={setError} /></>}
                  </li>;
                })}</ul>}
              </section>;
            })}
          </section>
        ))}
      </section>

      {!evidence.external && <ExtinguisherMeasurementFields typeCode={props.object.typeCode} values={measurementValues} onChange={(code, value) => setMeasurementValues((current) => {
        const next = new Map(current); next.set(code, value); return next;
      })} />}
      <label className="field"><span>Примечание</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error !== null && <p className="error">{error}</p>}
      {errors.length > 0 && <div className="validation-summary"><strong>Для завершения проверки:</strong><ul>{errors.slice(0, 8).map((message) => <li key={message}>{message}</li>)}</ul></div>}
      {/*
        * Запись журнала заводится только за подписью.
        *
        * Заказчик: «при заведении нового огнетушителя или элемента, и вообще при
        * создании новых строк в журнале должна ставиться ПЭП»; «тот, кто не
        * имеет доступа, и менять ничего не может».
        *
        * Прежде рядом с «Подписать ПЭП» стояло «Внести без подписи», и запись
        * могла появиться ничьей. Ничья запись в журнале эксплуатации — это
        * работа, за которую никто не отвечает: предъявить её при проверке
        * нельзя, а спросить не с кого.
        *
        * Кто подписывать не вправе — гость или человек с временным паролем,
        * который знают двое, — записи не заводит вовсе. Ему сказано, почему.
        */}
      {props.canSign && (
        <div className="sign-block">
          <label className="field">
            <span>Пароль для подписи</span>
            <input
              type="password"
              value={password}
              autoComplete="off"
              placeholder="ваш пароль от входа в программу"
              aria-invalid={signatureError !== null}
              onChange={(event) => {
                setPassword(event.target.value);
                if (signatureError !== null) setSignatureError(null);
              }}
            />
          </label>
          {signatureError !== null && (
            <p className="signature-inline-error" role="alert">
              <span className="signature-error-icon" aria-hidden="true">!</span>
              {signatureError}
            </p>
          )}
          <p className="muted small">
            Подпись подтверждает, что сведения внесли вы. Она содержит отпечаток записи: если запись
            изменят, сверка это покажет.
          </p>
        </div>
      )}
      {!props.canSign && (
        <p className="small warn">
          Записывать проверку в журнал может только тот, кто вправе её подписать. Обратитесь к
          администратору: подпись — это принятие ответственности за то, что написано в записи.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={errors.length > 0 || props.busy || !props.canSign || password.trim() === ''}
          title={props.canSign && password.trim() === ''
            ? 'Введите пароль: подпись ставится паролем'
            : undefined}
          onClick={() => submit(true)}
        >
          Подписать ПЭП и записать в журнал
        </button>
      </div>
    </div>
  </div>;
}


/**
 * Вложения принадлежат одному пункту чек-листа, а не мероприятию целиком:
 * при выгрузке истории понятно, каким именно замечанием подтверждён файл.
 * Нативный выбор работает в Electron, а input с capture позволяет мобильному
 * браузеру предложить камеру, когда интерфейс будет открыт в веб-версии.
 */
function ChecklistAttachments(props: {
  readonly value: readonly import('@izh/contracts').StoredDocumentReference[];
  readonly onChange: (value: readonly import('@izh/contracts').StoredDocumentReference[]) => void;
  readonly onError: (message: string) => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const addFromPicker = async (): Promise<void> => {
    const picked = await window.izh.openMaintenanceDocument();
    if (!picked.ok) { props.onError(picked.error.message); return; }
    if (picked.value === null) return;
    const extension = extensionOf(picked.value.fileName);
    const stored = await window.izh.store.put(picked.value.bytes, extension);
    if (!stored.ok) { props.onError(stored.error.message); return; }
    props.onChange([...props.value, { hash: stored.value, fileName: picked.value.fileName }]);
  };
  const addFromInput = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const stored = await window.izh.store.put(new Uint8Array(await file.arrayBuffer()), extensionOf(file.name));
    if (!stored.ok) { props.onError(stored.error.message); return; }
    props.onChange([...props.value, { hash: stored.value, fileName: file.name }]);
    if (inputRef.current !== null) inputRef.current.value = '';
  };
  return <div className="checklist-attachments">
    <button type="button" className="link" onClick={() => void addFromPicker()}>Добавить фото / файл</button>
    <input ref={inputRef} className="visually-hidden" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" capture="environment" onChange={(event) => void addFromInput(event.target.files?.[0])} />
    <button type="button" className="link mobile-camera" onClick={() => inputRef.current?.click()}>Камера / галерея</button>
    {props.value.length > 0 && <ul className="small attachment-list">{props.value.map((file) => <li key={file.hash}>{file.fileName} <button type="button" className="link" onClick={() => props.onChange(props.value.filter((item) => item.hash !== file.hash))}>убрать</button></li>)}</ul>}
  </div>;
}

function extensionOf(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase('ru');
  return extension === undefined || extension === fileName ? 'bin' : extension;
}

/**
 * Самая срочная работа группы: по ней и красится срок всей группы.
 *
 * Просроченное важнее приближающегося, приближающееся важнее спокойного. Если
 * внутри квартального срока просрочен хоть один осмотр, группа обязана гореть
 * красным целиком — иначе просрочку не заметят под свёрнутым заголовком.
 */
/**
 * Та из двух ячеек, чей срок тревожнее.
 *
 * Одна работа у нескольких элементов имеет разные сроки: у одного извещателя
 * проверка просрочена, у другого впереди. Подпись показывает худший — иначе
 * группа выглядела бы благополучной по самому благополучному в ней.
 */
function moreUrgent(a: ActivityCell, b: ActivityCell): ActivityCell {
  return urgentOf([a, b]);
}

function urgentOf(cells: readonly ActivityCell[]): ActivityCell {
  const rank = (status: string): number =>
    status === 'просрочено' ? 0 : status === 'скоро' ? 1 : status === 'норма' ? 2 : 3;

  return [...cells].sort((a, b) => rank(a.schedule.status) - rank(b.schedule.status)
    || (a.schedule.nextDate ?? '9999-12-31').localeCompare(b.schedule.nextDate ?? '9999-12-31'))[0] ?? cells[0] as ActivityCell;
}
