/**
 * Раздел «Регламентные мероприятия» (ТЗ, Дополнение 5, части Р3, Р7, Р12).
 *
 * Путь из требований: Настройки → Регламентные мероприятия → вид оборудования.
 * Слева виды, справа конструктор выбранного. Сверху — уровень, на котором
 * настраивается регламент: организация, цех или здание.
 *
 * Пока организация ничего не настроила, показывается нормативная библиотека по
 * умолчанию — регламент, который начнёт действовать, если его выпустить. Пустой
 * экран здесь был бы вреден: у пользователя должно быть от чего отталкиваться.
 *
 * Ниже уровня организации библиотека уже не подставляется: цех **дополняет**
 * организацию, а не повторяет её (часть Р8). Что действует сверху, показано
 * отдельно и только для чтения.
 */

import { useEffect, useMemo, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { RegulationActivity, RegulationPeriodicity, RegulationTemplate, TreeNode } from '@izh/contracts';
import { ELEMENT_CATALOG, ELEMENT_FAMILIES, activitiesFor, defaultPeriodicities, elementByCode, groupOfType, pathToNode, periodicityTitle, type ElementGroup } from '@izh/core';
import { assembleRegulation } from '@izh/engine-regulations';
import { formatDateRu } from '../format';
import type { RegulationsState } from '../use-regulations';
import { AddActivityModal } from './AddActivityModal';
import { RegulationConstructor } from './RegulationConstructor';
import { RegulationPreview } from './RegulationPreview';
import { RegulationScopeBar } from './RegulationScopeBar';
import { RegulationTemplates } from './RegulationTemplates';
import {
  REGULATION_GROUP_ORDER,
  RegulationGroupIcon,
  RegulationTypeList,
  type SelectableType,
} from './RegulationTypeList';
import { regulationTargets, scopeLabel, type RegulationTarget } from './regulation-targets';

export interface RegulationsModalProps {
  readonly organizationId: string | null;
  readonly nodes: readonly TreeNode[];
  readonly state: RegulationsState;
  readonly busy: boolean;
  readonly newId: () => string;
  readonly today: string;
  readonly onClose: () => void;
  /** Переход к локальным нормативным документам (часть Р6). */
  readonly onOpenDocuments: () => void;
  /** Выпуск версии: если регламента ещё нет, он создаётся вместе с ней. */
  readonly onRelease: (
    target: RegulationTarget,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ) => void;
  readonly onSaveTemplate: (
    title: string,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ) => void;
}

/**
 * Виды оборудования, для которых имеет смысл открывать конструктор.
 *
 * Раньше здесь стоял фильтр по `showInLibrary` — тот самый признак, которым
 * каталог прячет служебные подвиды, чтобы не дублировать элемент в правой
 * панели. Для регламентов он оказался ровно неверным: правила заведены как раз
 * на подвиды («Огнетушитель порошковый», «Извещатель дымовой»), и они
 * пропадали из списка. Организация открывала конструктор и видела пустоту по
 * тому оборудованию, которого у неё больше всего.
 *
 * Теперь берётся объединение: всё, что показывается в библиотеке, плюс всё, для
 * чего в нормативной библиотеке есть правила. Вид без правил тоже нужен —
 * регламент по нему организация вправе завести с нуля.
 */
function selectableTypes(): readonly SelectableType[] {
  // Не по ключам `RULE_PACKAGE`, а по `activitiesFor`: требования НПА живут
  // отдельно от типовых регламентов и подставляются поверх, так что вид может
  // иметь правила, не значась в самом пакете.
  const codes = new Set<string>([
    ...ELEMENT_CATALOG.filter((element) => element.showInLibrary !== false).map((element) => element.typeCode),
    ...ELEMENT_CATALOG.filter((element) => activitiesFor(element.typeCode).length > 0).map((element) => element.typeCode),
  ]);

  for (const family of ELEMENT_FAMILIES) codes.delete(family.parent);

  return [...codes]
    .map((typeCode) => ({
      typeCode,
      title: elementByCode(typeCode)?.title ?? typeCode,
      hasRules: activitiesFor(typeCode).length > 0,
    }))
    // Виды с заведёнными правилами идут первыми: с них и начинают настройку.
    .sort((a, b) => Number(b.hasRules) - Number(a.hasRules) || a.title.localeCompare(b.title, 'ru'));
}

/** Месяцы интервального правила; прочие правила уходят в конец списка. */
function monthsOfRule(rule: RegulationPeriodicity['rule']): number {
  if (rule.kind !== 'интервал') return Number.MAX_SAFE_INTEGER;
  return rule.unit === 'год' ? rule.every * 12 : rule.every;
}

function regulationGroupClass(group: (typeof REGULATION_GROUP_ORDER)[number]): string {
  if (group === 'снаружи здания') return 'outside';
  if (group === 'внутри здания') return 'inside';
  return 'automation';
}

function RegulationsOverview(props: {
  readonly types: readonly SelectableType[];
  readonly onOpenGroup: (group: ElementGroup) => void;
}): React.JSX.Element {
  return (
    <section className="regulations-overview">
      <p className="eyebrow">Конструктор элементов</p>
      <h3>Все разделы</h3>
      <p className="muted small">
        Выберите систему, затем конкретный вид оборудования. При новом открытии
        конструктор всегда возвращается к этому обзору.
      </p>
      <div className="regulations-overview-grid">
        {REGULATION_GROUP_ORDER.map((group) => {
          const items = props.types.filter((item) => groupOfType(item.typeCode) === group);
          return (
            <button
              key={group}
              type="button"
              className={`regulations-overview-card group-${regulationGroupClass(group)}`}
              disabled={items.length === 0}
              onClick={() => props.onOpenGroup(group)}
            >
              <RegulationGroupIcon group={group} />
              <span>
                <strong>{group}</strong>
                <small>{items.length} {items.length === 1 ? 'вид' : 'видов оборудования'}</small>
              </span>
              <span className="regulations-overview-arrow" aria-hidden="true">→</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function RegulationsModal(props: RegulationsModalProps): React.JSX.Element {
  const types = useMemo(selectableTypes, []);
  const targets = useMemo(() => regulationTargets(props.nodes), [props.nodes]);
  // Пустой код — осознанный обзор всех разделов. Не запоминаем последний вид:
  // каждый новый вход начинается с общей структуры, а не со случайного элемента.
  const [typeCode, setTypeCode] = useState('');
  const [focusedGroup, setFocusedGroup] = useState<ElementGroup | null>(null);
  const [targetId, setTargetId] = useState(props.organizationId ?? '');
  const [draft, setDraft] = useState<readonly RegulationPeriodicity[]>([]);
  const [addingTo, setAddingTo] = useState<RegulationPeriodicity | null>(null);
  const [preview, setPreview] = useState(false);

  const target = targets.find((item) => item.targetId === targetId) ?? targets[0] ?? null;
  const targetScope = target?.scope ?? null;

  /** Действующая версия регламента этого уровня по этому виду, если она есть. */
  const current = useMemo(() => {
    if (target === null || typeCode === '') return null;
    const regulation = props.state.regulations.find(
      (item) => item.scope === target.scope && item.targetId === target.targetId
        && item.typeCode === typeCode && item.archivedAt === null,
    );
    if (regulation === undefined) return null;

    const versions = props.state.versions
      .filter((version) => version.regulationId === regulation.id)
      .sort((a, b) => b.version - a.version);
    return versions[0] ?? null;
  }, [props.state.regulations, props.state.versions, typeCode, target]);

  /**
   * Что действует на этот уровень сверху.
   *
   * Путь берётся до родителя, а не до самого узла: собственный регламент этого
   * уровня — это черновик рядом, и показывать его ещё и как унаследованный
   * значило бы вводить в заблуждение.
   */
  const inherited = useMemo(() => {
    if (target === null || target.scope === 'организация' || typeCode === '') return [];
    const path = pathToNode(props.nodes, target.targetId).map((node) => node.id);
    return assembleRegulation({
      regulations: props.state.regulations,
      versions: props.state.versions,
      nodePath: path.slice(0, -1),
      objectId: '',
      typeCode,
      onDate: props.today,
    }).periodicities;
  }, [props.nodes, props.state.regulations, props.state.versions, typeCode, target, props.today]);

  // Черновик берётся из действующей версии этого уровня. Своей версии нет —
  // на уровне организации подставляется нормативная библиотека, ниже пусто:
  // цех дополняет организацию, а не переписывает её заново.
  useEffect(() => {
    if (typeCode === '') {
      setDraft([]);
      return;
    }
    if (current !== null) {
      setDraft(current.periodicities);
      return;
    }
    setDraft(targetScope === 'организация' ? defaultPeriodicities(typeCode) : []);
  }, [current, typeCode, targetScope]);

  const addActivity = (activity: RegulationActivity): void => {
    if (addingTo === null) return;
    setDraft((items) =>
      items.map((item) =>
        item.id === addingTo.id ? { ...item, activities: [...item.activities, activity] } : item,
      ),
    );
    setAddingTo(null);
  };

  /**
   * Применение шаблона.
   *
   * Идентификаторы периодичностей выдаются новые: иначе цех и здание делили бы
   * одну и ту же периодичность, а записи журнала ссылаются на неё по
   * идентификатору — и история двух разных мест слиплась бы в одну.
   */
  const applyTemplate = (template: RegulationTemplate): void => {
    setDraft(template.periodicities.map((item) => ({ ...item, id: props.newId() })));
  };

  const typeTitle = types.find((item) => item.typeCode === typeCode)?.title ?? typeCode;

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal regulations-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Регламентные мероприятия</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        {props.state.error !== null && <p className="banner error">{props.state.error}</p>}

        {target === null ? (
          <p className="muted small">
            Регламент назначается на организацию, цех или здание. Создайте организацию в дереве
            объекта — тогда появится, к чему привязать сроки.
          </p>
        ) : (
          <div className="regulations-body">
            <RegulationTypeList
              types={types}
              selected={typeCode}
              focusedGroup={focusedGroup}
              onSelect={(next) => { setTypeCode(next); setFocusedGroup(null); }}
            />

            <div className="regulations-editor">
              {typeCode === '' ? (
                <RegulationsOverview types={types} onOpenGroup={setFocusedGroup} />
              ) : (
                <>
              <RegulationScopeBar
                targets={targets}
                selected={target}
                inherited={inherited}
                busy={props.busy}
                onSelect={(next) => setTargetId(next.targetId)}
              />

              <p className="muted small">
                {current === null
                  ? `Регламента ${scopeLabel(target.scope)} по этому виду ещё нет. Выпустите версию, чтобы он начал действовать.`
                  : `Действует версия v${current.version} с ${formatDateRu(current.effectiveFrom)}.`}
              </p>

              <RegulationConstructor
                typeTitle={typeTitle}
                note={typeCode.startsWith('suppression-')
                  ? 'Порядок обслуживания модульной установки задают паспорт изделия и проектная документация (ППР РФ №1479, п. 54). Приведённые здесь сроки — типовые, из распространённых паспортов: сверьте их с документами на установленное оборудование и при необходимости измените.'
                  : null}
                periodicities={draft}
                busy={props.busy}
                onChange={setDraft}
                onAddActivity={(periodicityId) =>
                  setAddingTo(draft.find((item) => item.id === periodicityId) ?? null)
                }
                onAddPeriodicity={(months) => setDraft((current) => [
                  ...current,
                  {
                    id: props.newId(),
                    title: periodicityTitle(months),
                    rule: { kind: 'интервал' as const, every: months, unit: 'месяц' as const },
                    // Новый срок сразу используется: его завели затем, чтобы по
                    // нему работать, а не чтобы он лежал выключенным.
                    enabled: true,
                    activities: [],
                    warnDaysBefore: null,
                    activityCodes: [],
                  },
                ].sort((a, b) => monthsOfRule(a.rule) - monthsOfRule(b.rule)))}
                onPreview={() => setPreview(true)}
                onRelease={() => props.onRelease(target, typeCode, draft)}
              />

              <section className="regulation-documents">
                <h4>Локальные документы</h4>
                <p className="muted small">
                  Приказы и инструкции предприятия, на которые ссылаются свои мероприятия.
                  Заведённый здесь документ появляется в выборе основания.
                </p>
                <button type="button" disabled={props.busy} onClick={props.onOpenDocuments}>
                  Открыть перечень документов →
                </button>
              </section>

              <RegulationTemplates
                typeCode={typeCode}
                templates={props.state.templates}
                busy={props.busy}
                onApply={applyTemplate}
                onSave={(title) => props.onSaveTemplate(title, typeCode, draft)}
              />
                </>
              )}
            </div>
          </div>
        )}

        {addingTo !== null && (
          <AddActivityModal
            periodicityTitle={addingTo.title}
            documents={props.state.documents}
            today={props.today}
            busy={props.busy}
            newId={props.newId}
            onClose={() => setAddingTo(null)}
            onAdd={addActivity}
          />
        )}

        {preview && (
          <RegulationPreview
            typeTitle={typeTitle}
            periodicities={draft}
            onClose={() => setPreview(false)}
          />
        )}
      </div>
    </div>
  );
}
