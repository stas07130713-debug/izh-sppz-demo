/**
 * Окна настройки программы: сами настройки, регламенты и локальные документы.
 *
 * Вынесено из главного экрана как одна связная группа. Все три окна отвечают на
 * один вопрос — «как программа настроена», — открываются одно из другого и
 * пользуются одними сведениями: настройками, регламентами и деревом.
 *
 * Группа держит **своё состояние**, а не получает его сверху: какое из трёх окон
 * открыто, идёт ли сохранение, чем заняты действия над регламентами. Первый
 * заход выносил только разметку — и не дал ничего: тридцать свойств на месте
 * вызова заняли ровно столько же, сколько убрала разметка. Сложность не уходит,
 * пока состояние остаётся наверху (часть С110).
 *
 * Главному экрану остаётся одно: сказать «откройся на такой-то вкладке». Он это
 * и так делал — шестерёнкой в шапке и переходом с дашборда за его составом.
 */

import { useState } from 'react';
import type {
  AppSettings, JournalExportRequest, MaintenanceEvent, PlanObject,
  RegulationPeriodicity, TreeNode,
} from '@izh/contracts';
import { describeUnknown } from '@izh/contracts';
import { saveCustomElementChecks } from '@izh/core';
import { SettingsModal } from './SettingsModal';
import { RegulationsModal } from './RegulationsModal';
import { LocalDocumentsModal, type DocumentDraft } from './LocalDocumentsModal';
import { RequestBuilder } from './RequestBuilder';
import { BackdropSettings, type BackdropRow } from './BackdropSettings';
import type { RegulationTarget } from './regulation-targets';
import type { RegulationsState } from '../use-regulations';
import { useRegulationActions } from '../use-regulation-actions';
import { useDocumentActions } from '../use-document-actions';
import { maintenanceDeps, objectDeps, regulationDeps } from '../deps';
import { todayIso } from '../today';

/** С какой вкладки открыть настройки. `null` — окно закрыто. */
export type SettingsRequest = 'план' | 'журнал' | 'дашборд' | null;

export interface SettingsScreensProps {
  /** Просьба открыться: приходит от шестерёнки в шапке и от дашборда. */
  readonly request: SettingsRequest;
  readonly onClosed: () => void;

  readonly settings: AppSettings;
  readonly reloadSettings: () => Promise<void>;
  readonly setMessage: (message: string) => void;

  readonly nodes: readonly TreeNode[];
  readonly selected: TreeNode | null;
  readonly allObjects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];

  /**
   * Регламенты читает главный экран: по ним считаются сроки во всём журнале и
   * на плане, и второе чтение здесь означало бы два набора правил в одной
   * программе.
   */
  readonly regulations: RegulationsState;

  /** Подложки и переходы к плану: они за пределами настроек. */
  readonly backdropRows: readonly BackdropRow[];
  readonly onSetBackdropScale: (row: BackdropRow) => void;
  readonly onEditBackdrop: (row: BackdropRow) => void;
  readonly onReplaceBackdrop: (row: BackdropRow) => void;

  readonly onExport: (request: JournalExportRequest, title: string) => void;
}

export function SettingsScreens(props: SettingsScreensProps): React.JSX.Element {
  /*
   * Регламенты и документы открываются только отсюда, поэтому и живут здесь.
   * Занятость одна на все три окна: работа у них общая — запись настроек.
   */
  const [regulationsOpen, setRegulationsOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { setMessage, regulations } = props;
  const regulationActions = useRegulationActions({ state: regulations, setBusy, setMessage });
  const documentActions = useDocumentActions({ state: regulations, setBusy, setMessage });

  const organizationId = props.nodes.find((node) => node.kind === 'organization')?.id ?? null;

  /**
   * Сохранение настроек.
   *
   * Занятость снимается в `finally`: сорвавшийся мост иначе оставлял бы окно
   * заблокированным до перезапуска программы.
   */
  const save = async (next: AppSettings, keepOpen = false): Promise<void> => {
    setBusy(true);
    let saved;
    try {
      saved = await window.izh.settings.save(next);
    } catch (e) {
      setMessage(`Не удалось сохранить настройки: ${describeUnknown(e)}`);
      return;
    } finally {
      setBusy(false);
    }

    if (!saved.ok) { setMessage(saved.error.message); return; }

    /*
     * Окно закрывается не всегда.
     *
     * Заведённый свой вид записывается сразу, посреди работы: следующим
     * шагом человек назначает ему проверки, и закрыть перед этим окно
     * значило бы выставить его за дверь на полпути.
     */
    if (!keepOpen) props.onClosed();
    await props.reloadSettings();
    setMessage(keepOpen ? 'Сохранено.' : 'Настройки сохранены.');
  };

  return (
    <>
      {props.request !== null && (
        <SettingsModal
          settings={props.settings}
          busy={busy}
          initialTab={props.request}
          onClose={props.onClosed}
          onSave={(next) => { void save(next); }}
          onSaveKeepingOpen={(next) => { void save(next, true); }}
          onOpenRegulations={() => { props.onClosed(); setRegulationsOpen(true); }}
          newId={() => objectDeps.ids.newId()}
          now={() => objectDeps.clock.nowUtc()}
          regulations={regulations.regulations}
          versions={regulations.versions}
          onSaveCustomChecks={(typeCode, title, periodicities) => {
            void (async () => {
              const saved = await saveCustomElementChecks(regulationDeps, {
                typeCode,
                title,
                periodicities,
                today: todayIso(),
                regulations: regulations.regulations,
              });
              // Регламент прочитан заново: список проверок в настройках
              // показывается из него, и без перечитывания он остался бы
              // прежним — человек решил бы, что сохранение не сработало.
              if (saved.ok) await regulations.reload();
              else setMessage(saved.error.message);
            })();
          }}
          objects={props.allObjects}
          onMessage={setMessage}
          backdropSection={
            <BackdropSettings
              rows={props.backdropRows}
              onSetScale={props.onSetBackdropScale}
              onEdit={props.onEditBackdrop}
              onReplace={props.onReplaceBackdrop}
            />
          }
          requestBuilder={
            <RequestBuilder
              nodes={props.nodes}
              node={props.selected}
              allObjects={props.allObjects}
              events={props.events}
              settings={props.settings}
              newId={() => maintenanceDeps.ids.newId()}
              onSaveTemplate={(template) => {
                // Шаблон с тем же названием заменяется, а не копится рядом:
                // «сохранить» после правки — это правка, а не второй шаблон.
                const rest = props.settings.requestTemplates.filter((item) => item.title !== template.title);
                /*
                 * Окно не закрывается.
                 *
                 * Заказчик: «при нажатии кнопки создать шаблон или удалить не
                 * нужно, чтобы выбрасывало из окна настройки». И правда:
                 * шаблон сохраняют посреди работы над заявкой, а не в конце —
                 * закрывать окно на этом шаге значит выставить человека за
                 * дверь на полпути.
                 */
                void save({ ...props.settings, requestTemplates: [...rest, template] }, true);
              }}
              onDeleteTemplate={(id) => {
                void save({
                  ...props.settings,
                  requestTemplates: props.settings.requestTemplates.filter((item) => item.id !== id),
                }, true);
              }}
              onExport={(request) => props.onExport(request, 'Заявка')}
            />
          }
        />
      )}

      {regulationsOpen && (
        <RegulationsModal
          organizationId={organizationId}
          nodes={props.nodes}
          state={regulations}
          busy={busy}
          newId={() => regulationDeps.ids.newId()}
          today={todayIso()}
          onClose={() => setRegulationsOpen(false)}
          onOpenDocuments={() => setDocumentsOpen(true)}
          onRelease={(target: RegulationTarget, typeCode: string, periodicities: readonly RegulationPeriodicity[]) => {
            void regulationActions.release(target, typeCode, periodicities);
          }}
          onSaveTemplate={(title: string, typeCode: string, periodicities: readonly RegulationPeriodicity[]) => {
            void regulationActions.saveTemplate(title, typeCode, periodicities);
          }}
        />
      )}

      {documentsOpen && (
        <LocalDocumentsModal
          documents={regulations.documents}
          busy={busy}
          today={todayIso()}
          error={regulations.error}
          onClose={() => setDocumentsOpen(false)}
          onSave={(draft: DocumentDraft) => { void documentActions.save(draft); }}
          onAttachFile={documentActions.attachFile}
        />
      )}
    </>
  );
}
