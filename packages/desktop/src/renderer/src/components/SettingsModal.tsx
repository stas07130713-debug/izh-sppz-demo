/**
 * Настройки программы, разложенные по вкладкам (ТЗ, Дополнение 6, часть С52).
 *
 * Вкладки те же, что у рабочей области: «План», «Журнал», «Дашборд». Настройка
 * ищется там же, где стоит экран, к которому она относится, — иначе список
 * настроек растёт вперемешку, и через полгода в нём не найти ничего.
 *
 * Общие настройки (порог «скоро», формат карточки) лежат на вкладке «Журнал»:
 * они задают сроки и выгрузку, а это работа журнала.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { AppSettings, Regulation, RegulationPeriodicity, RegulationVersion } from '@izh/contracts';
import { DashboardSettings } from './DashboardSettings';
import { CustomElementsSettings } from './CustomElementsSettings';
import { ElementIconsSettings } from './ElementIconsSettings';
import { JournalColumnsSettings } from './JournalColumnsSettings';

/*
 * Вкладки «Люди» здесь больше нет.
 *
 * Заказчик: «управление пользователями уже реализуется в личном кабинете
 * через раздел "Личный кабинет → Пользователи системы"; дублирование одного
 * и того же функционала в двух местах не требуется».
 *
 * Убрана только вкладка — сами учётные записи, их роли и области доступа
 * лежат там же, где лежали, и работают через личный кабинет.
 */
type SettingsTab = 'план' | 'журнал' | 'дашборд' | 'элементы' | 'заявка';

const TABS: readonly { readonly id: SettingsTab; readonly title: string }[] = [
  { id: 'план', title: 'План' },
  { id: 'журнал', title: 'Журнал' },
  { id: 'дашборд', title: 'Дашборд' },
  { id: 'элементы', title: 'Элементы' },
  { id: 'заявка', title: 'Заявка' },
];

interface Props {
  readonly settings: AppSettings;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSave: (settings: AppSettings) => void;
  /** Записать настройки, не закрывая окно: для правок посреди работы. */
  readonly onSaveKeepingOpen: (settings: AppSettings) => void;
  /** Переход в конструктор регламентов (ТЗ, Дополнение 5, часть Р3). */
  readonly onOpenRegulations: () => void;
  /** С какой вкладки открыть: с дашборда сюда приходят за его составом. */
  readonly initialTab?: SettingsTab;
  /** Свои виды элементов заводятся с новым кодом и датой — их даёт оболочка. */
  readonly newId: () => string;
  readonly now: () => string;
  /**
   * Регламенты — для раздела «Элементы»: проверки своего вида хранятся
   * регламентом, как у встроенных, и показывать их надо оттуда же.
   */
  readonly regulations: readonly Regulation[];
  readonly versions: readonly RegulationVersion[];
  readonly onSaveCustomChecks: (
    typeCode: string, title: string, periodicities: readonly RegulationPeriodicity[],
  ) => void;
  /** Заведённое оборудование: по нему видно, можно ли убрать свой вид совсем. */
  readonly objects: readonly { readonly typeCode: string; readonly archivedAt: string | null }[];
  /** Сказать человеку то, что окно настроек само сказать не может. */
  readonly onMessage: (message: string) => void;
  /**
   * Раздел подложек вкладки «План».
   *
   * Приходит готовым блоком, а не собирается здесь: подложки и их масштабы
   * живут в хранилище планов, и тянуть их в окно настроек значило бы
   * связать настройки со всем, что умеет план.
   */
  readonly backdropSection: React.ReactNode;
  /**
   * Список пользователей. null — у вошедшего нет права их менять, и вкладка
   * не показывается вовсе: она предлагала бы то, чего он всё равно не сделает.
   */

  /** Вкладка «Заявка» собирается по живому оборудованию, а не по настройкам. */
  readonly requestBuilder: React.ReactNode;
}

export function SettingsModal(props: Props): React.JSX.Element {
  const [draft, setDraft] = useState(props.settings);
  const [tab, setTab] = useState<SettingsTab>(props.initialTab ?? (TABS[0] as { id: SettingsTab }).id);
  /** Отказ при чтении картинки значка: показывается рядом с разделом. */
  const [iconError, setIconError] = useState<string | null>(null);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  const validThreshold =
    Number.isInteger(draft.soonThresholdDays) && draft.soonThresholdDays >= 1 && draft.soonThresholdDays <= 365;

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Настройки программы</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <div className="settings-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'settings-tab active' : 'settings-tab'}
              onClick={() => setTab(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {tab === 'план' && <PlanTab backdrops={props.backdropSection} />}

          {tab === 'журнал' && (
            <>
              {/*
                * Три настройки вкладки — в том порядке, в каком их назвал
                * заказчик: состав таблицы, регламенты, срок предупреждения.
                */}
              <JournalColumnsSettings
                columns={draft.journalColumns}
                onCommit={(columns) => {
                  set('journalColumns', columns);
                  props.onSaveKeepingOpen({ ...draft, journalColumns: columns });
                }}
              />

              {/* Регламенты вынесены отдельным разделом: там своя большая
                  настройка — периодичности, состав работ и версии (Дополнение 5). */}
              <section className="settings-section">
                <h4>Регламентные мероприятия</h4>
                <p className="muted small">
                  Периодичность и состав работ по видам оборудования. Правки выпускаются версией:
                  прошлые проверки сохраняют свой состав.
                </p>
                <button type="button" onClick={props.onOpenRegulations}>
                  Открыть конструктор регламентов →
                </button>
              </section>

              <section className="settings-section">
                <h4>Сроки</h4>
                {/*
                  * Настройки формата карточки здесь больше нет. Заказчик:
                  * «убери настройку формат карточки по умолчанию — не нужно,
                  * так как пользователь сам выбирает при её скачивании».
                  * Выбор при выгрузке остался: он на месте и виден.
                  */}
                <label className="field">
                  <span>Предупреждать до наступления срока, дней</span>
                  <input
                    type="number" min={1} max={365} value={draft.soonThresholdDays}
                    onChange={(event) => set('soonThresholdDays', Number(event.target.value))}
                  />
                </label>
                <p className="muted small">
                  За сколько дней до срока показывать метку «скоро» и уведомление.
                </p>
                {!validThreshold && <p className="error">Укажите от 1 до 365 дней.</p>}
              </section>
            </>
          )}

          {tab === 'дашборд' && (
            <DashboardSettings
              blocks={draft.dashboardBlocks}
              /*
               * Состав дашборда записывается сразу, а не по общей кнопке.
               *
               * Заказчик: «возможность менять местами отображаемые элементы не
               * работает». Стрелки к тому времени уже двигали блоки — и в
               * списке, и на дашборде, — но лишь после «Сохранить настройки».
               * Кто переставил блоки и закрыл окно крестиком, не видел ничего:
               * правка оставалась в черновике и уходила вместе с окном.
               *
               * Здесь это особенно легко упустить: галочка и стрелка выглядят
               * как действие, а не как заполнение поля, — и ждать от них
               * отдельного подтверждения человек не станет. Тот же порядок уже
               * принят для своих видов элементов.
               */
              onChange={(blocks) => {
                set('dashboardBlocks', blocks);
                props.onSaveKeepingOpen({ ...draft, dashboardBlocks: blocks });
              }}
            />
          )}

          {tab === 'элементы' && (
            <>
            <ElementIconsSettings
              icons={draft.elementIcons}
              onChange={(icons) => set('elementIcons', icons)}
              titles={draft.elementTitles}
              onChangeTitles={(titles) => set('elementTitles', titles)}
              onError={setIconError}
            />
            {iconError !== null && <p className="error">{iconError}</p>}
            <CustomElementsSettings
              types={draft.customElements}
              /*
               * Заведённый вид записывается сразу, а не по общей кнопке.
               *
               * Заказчик: «не создаётся регламент проверки для нового
               * созданного элемента». Причина была в двух кнопках: вид
               * копился в черновике настроек и ждал «Сохранить настройки», а
               * проверки писались регламентом сразу. Кто закрывал окно, не
               * нажав общую кнопку, получал регламент без вида; кто нажимал
               * её, не заходя в проверки, — вид без регламента, и элементы
               * этого вида навсегда оставались «нет данных».
               */
              onCommit={(types) => props.onSaveKeepingOpen({ ...draft, customElements: types })}
              onChange={(types) => set('customElements', types)}
              newId={props.newId}
              now={props.now}
              busy={props.busy}
              regulations={props.regulations}
              versions={props.versions}
              onSaveChecks={props.onSaveCustomChecks}
              objects={props.objects}
              onMessage={props.onMessage}
              onOpenRegulations={props.onOpenRegulations}
            />
            </>
          )}

          {/* Заявка не хранится в настройках — здесь хранится только её шаблон.
              Сам список оборудования собирается по дереву, поэтому вкладка
              приходит готовой снаружи. */}
          {tab === 'заявка' && props.requestBuilder}
        </div>

        {tab !== 'заявка' && (
          <div className="actions">
            <button
              type="button" className="primary" disabled={props.busy || !validThreshold}
              onClick={() => props.onSave(draft)}
            >
              Сохранить настройки
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Вкладка «План».
 *
 * Своих настроек у плана пока нет: закрепление объектов и отбор по состоянию
 * живут на самом плане, где ими и пользуются, а расчёт расстановки
 * огнетушителей ещё не сделан. Пустая вкладка честнее выдуманных полей —
 * она говорит, где эти настройки появятся.
 */
function PlanTab({ backdrops }: { readonly backdrops: React.ReactNode }): React.JSX.Element {
  return <>{backdrops}</>;
}
