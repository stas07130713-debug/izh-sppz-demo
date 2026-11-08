/**
 * Раздел настроек «Свои элементы» (движок E4).
 *
 * Список заведённых видов и вход в две формы: описание вида (значок, название,
 * области, поля карточки) и его проверки (что делают и как часто).
 *
 * Описание вида хранится в настройках, проверки — регламентом, как у встроенных
 * видов. Для пользователя это одно окно; разница в хранении на него не выходит,
 * но нужна: сроки считает движок регламентов, и второго хранилища у них быть
 * не должно.
 */

import { useState } from 'react';
import type { CustomElementType, Regulation, RegulationPeriodicity, RegulationVersion } from '@izh/contracts';
import {
  customElementRegulation, customElementUsage, latestVersion, removeCustomElement,
  setCustomElementArchived, upsertCustomElement,
} from '@izh/core';
import { CustomElementEditor } from './CustomElementEditor';
import { CustomElementChecks } from './CustomElementChecks';
import { ElementIcon } from './ElementIcon';

export interface CustomElementsSettingsProps {
  readonly types: readonly CustomElementType[];
  readonly onChange: (types: readonly CustomElementType[]) => void;
  /**
   * Записать список видов немедленно, не дожидаясь общей кнопки настроек.
   *
   * Нужно потому, что проверки вида пишутся регламентом сразу: если вид
   * останется в черновике, а регламент уже записан, получится регламент без
   * вида — или, наоборот, вид без проверок, и его элементы навсегда «нет
   * данных».
   */
  readonly onCommit: (types: readonly CustomElementType[]) => void;
  /**
   * Заведённое оборудование: по нему видно, как убирать вид.
   *
   * Нужна и пометка о выводе из эксплуатации: единица в работе и единица
   * снятая решают судьбу вида по-разному.
   */
  readonly objects: readonly { readonly typeCode: string; readonly archivedAt: string | null }[];
  /** Сказать человеку, почему вид не удалён. */
  readonly onMessage: (message: string) => void;
  readonly newId: () => string;
  readonly now: () => string;
  readonly busy: boolean;
  /** Регламенты — чтобы показать уже назначенные проверки своего вида. */
  readonly regulations: readonly Regulation[];
  readonly versions: readonly RegulationVersion[];
  readonly onSaveChecks: (typeCode: string, title: string, periodicities: readonly RegulationPeriodicity[]) => void;
  /** Переход в полный конструктор регламентов. */
  readonly onOpenRegulations: () => void;
}

/** Что сейчас открыто: ничего, новый вид, либо один из двух разделов вида. */
type Editing =
  | { readonly what: 'нет' }
  | { readonly what: 'новый' }
  | { readonly what: 'вид'; readonly typeCode: string }
  | { readonly what: 'проверки'; readonly typeCode: string };

export function CustomElementsSettings(props: CustomElementsSettingsProps): React.JSX.Element {
  const [editing, setEditing] = useState<Editing>({ what: 'нет' });

  const editingType = editing.what === 'вид' || editing.what === 'проверки'
    ? props.types.find((type) => type.typeCode === editing.typeCode) ?? null
    : null;

  const active = props.types.filter((type) => type.archivedAt === null);

  /** Сколько проверок назначено виду — видно прямо в списке. */
  const checksOf = (typeCode: string): readonly RegulationPeriodicity[] => {
    const regulation = customElementRegulation(props.regulations, typeCode);
    if (regulation === null) return [];
    return latestVersion(props.versions, regulation.id)?.periodicities ?? [];
  };

  return (
    <>
      <section className="settings-section">
        <h4>Свои виды противопожарных элементов</h4>
        <p className="muted small">
          Если нужного оборудования нет в библиотеке, вид заводится здесь: значок, название, где
          применяется, поля карточки, проверки и их периодичность. Такой вид ведёт себя как
          встроенный — его ставят на план, он попадает в журнал и в дашборд.
        </p>

        {active.length === 0 ? (
          <p className="muted small">Своих видов пока нет.</p>
        ) : (
          <ul className="plain-list custom-types">
            {active.map((type) => {
              const checks = checksOf(type.typeCode);
              return (
                <li key={type.typeCode}>
                  <ElementIcon typeCode={type.typeCode} />
                  <strong>{type.title}</strong>
                  <span className="muted small"> — {type.placements.join(', ')}</span>
                  <span className="muted small">
                    {type.fields.length === 0 ? ' · своих полей нет' : ` · полей: ${type.fields.length}`}
                  </span>
                  {checks.length === 0 ? (
                    <span className="badge warn">проверок нет</span>
                  ) : (
                    <span className="muted small">· проверок: {checks.length}</span>
                  )}
                  <span className="custom-type-actions">
                    <button
                      type="button" className="link small"
                      onClick={() => setEditing({ what: 'вид', typeCode: type.typeCode })}
                    >
                      править вид
                    </button>
                    <button
                      type="button" className="link small"
                      onClick={() => setEditing({ what: 'проверки', typeCode: type.typeCode })}
                    >
                      проверки
                    </button>
                    {/*
                      * Вид уходит из настроек всегда — вопрос лишь в том, как.
                      *
                      * Заказчик: «при выведении из обращения элемента удаляй его
                      * полностью, не нужно отображать в настройках». И позже:
                      * «нельзя удалить ящик с песком; пишет, что надо сначала
                      * вывести его из эксплуатации, но по дереву его нигде нет».
                      *
                      * Второе было тупиком: считались все единицы вида, включая
                      * снятые, а совет давался «выведите из эксплуатации».
                      * Человек выводил единицу, она пропадала из дерева — и вид
                      * всё равно не удалялся. Теперь совет даётся только про
                      * единицы в работе, а когда все сняты, вид убирается из
                      * настроек и библиотеки; описание остаётся в хранилище,
                      * чтобы прежние записи журнала читались по названию, а не
                      * как «неизвестный вид».
                      */}
                    <button
                      type="button"
                      className="link small"
                      onClick={() => {
                        const usage = customElementUsage(type.typeCode, props.objects);

                        if (usage.removal === 'сначала снять с эксплуатации') {
                          props.onMessage(
                            `Вид «${type.title}» убрать нельзя: по нему в работе единиц — ${usage.activeCount}. `
                            + 'Сначала выведите их из эксплуатации или перенесите в другой вид.',
                          );
                          return;
                        }

                        if (usage.removal === 'убрать из настроек') {
                          const ask = `Убрать вид «${type.title}» из настроек? В работе по нему ничего нет, `
                            + `выведено из эксплуатации единиц — ${usage.archivedCount}. `
                            + 'Вид пропадёт из настроек и из библиотеки, новые единицы завести будет нельзя, '
                            + 'а прежние записи о нём в журнале останутся читаемыми.';
                          if (!confirm(ask)) return;
                          const next = setCustomElementArchived(props.types, type.typeCode, props.now());
                          props.onChange(next);
                          props.onCommit(next);
                          return;
                        }

                        if (!confirm(`Удалить вид «${type.title}» совсем? По нему ничего не заведено.`)) return;
                        const next = removeCustomElement(props.types, type.typeCode);
                        props.onChange(next);
                        props.onCommit(next);
                      }}
                    >
                      убрать вид
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {editing.what === 'нет' && (
          <div className="actions">
            <button type="button" onClick={() => setEditing({ what: 'новый' })}>Завести свой вид</button>
          </div>
        )}
      </section>

      {(editing.what === 'новый' || editing.what === 'вид') && (
        <section className="settings-section">
          <h4>{editingType === null ? 'Новый вид' : `Вид «${editingType.title}»`}</h4>
          <CustomElementEditor
            type={editingType}
            existing={props.types}
            newId={props.newId}
            now={props.now}
            onSave={(type) => {
              const next = upsertCustomElement(props.types, type);
              props.onChange(next);
              // Вид записывается тут же: проверки, которые человек назначит
              // следующим шагом, лягут регламентом сразу, и вид обязан быть на
              // месте к этому времени.
              props.onCommit(next);
              // Сразу после заведения человек идёт назначать проверки: без них
              // элемент этого вида показывается как «нет данных».
              setEditing({ what: 'проверки', typeCode: type.typeCode });
            }}
            onCancel={() => setEditing({ what: 'нет' })}
          />
        </section>
      )}

      {editing.what === 'проверки' && editingType !== null && (
        <section className="settings-section">
          <h4>Проверки вида «{editingType.title}»</h4>
          <CustomElementChecks
            key={editingType.typeCode}
            current={checksOf(editingType.typeCode)}
            newId={props.newId}
            busy={props.busy}
            onSave={(periodicities) => {
              props.onSaveChecks(editingType.typeCode, editingType.title, periodicities);
              setEditing({ what: 'нет' });
            }}
            onOpenRegulations={props.onOpenRegulations}
          />
          <div className="actions">
            <button type="button" className="link" onClick={() => setEditing({ what: 'нет' })}>закрыть</button>
          </div>
        </section>
      )}

    </>
  );
}
