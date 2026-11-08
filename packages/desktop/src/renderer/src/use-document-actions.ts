/**
 * Действия над локальными нормативными документами (Дополнение 5, часть Р6).
 *
 * Отдельно от главного экрана по той же причине, что и действия с регламентами:
 * это законченный кусок работы со своим предметом, а главный экран занят
 * связыванием частей.
 */

import { useCallback } from 'react';
import { saveLocalDocument } from '@izh/core';
import { regulationDeps } from './deps';
import { guardBusy } from './use-busy-run';
import type { DocumentDraft } from './components/LocalDocumentsModal';
import type { RegulationsState } from './use-regulations';

export interface DocumentActions {
  readonly save: (draft: DocumentDraft) => Promise<void>;
  /** Выбирает файл приказа и кладёт его в хранилище программы, возвращая хеш. */
  readonly attachFile: () => Promise<{ readonly hash: string; readonly fileName: string } | null>;
}

export interface DocumentActionsInput {
  readonly state: RegulationsState;
  readonly setBusy: (busy: boolean) => void;
  readonly setMessage: (message: string) => void;
}

/** Пустое поле формы — это «не задано», а не пустая строка в данных. */
function orNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

export function useDocumentActions(input: DocumentActionsInput): DocumentActions {
  const { state, setBusy, setMessage } = input;

  const save = useCallback(async (draft: DocumentDraft): Promise<void> => guardBusy(setBusy, setMessage, async () => {
    const result = await saveLocalDocument(regulationDeps, {
      id: draft.id,
      title: draft.title,
      number: orNull(draft.number),
      approvedOn: orNull(draft.approvedOn),
      effectiveFrom: orNull(draft.effectiveFrom),
      effectiveTo: orNull(draft.effectiveTo),
      organization: orNull(draft.organization),
      department: orNull(draft.department),
      fileHash: draft.fileHash,
      note: orNull(draft.note),
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    await state.reload();
    setMessage(
      draft.id === null
        ? `Документ «${result.value.title}» заведён. Теперь на него можно ссылаться в своих мероприятиях.`
        : `Документ «${result.value.title}» сохранён.`,
    );
  }), [state, setBusy, setMessage]);

  /**
   * Файл кладётся в хранилище программы и запоминается по хешу.
   *
   * Абсолютный путь пользователя в данных не хранится: база переносится на
   * другой компьютер, и путь вида `C:\Users\...` там ничего не откроет.
   */
  const attachFile = useCallback(async (): Promise<{ readonly hash: string; readonly fileName: string } | null> => {
    const picked = await window.izh.openMaintenanceDocument();
    if (!picked.ok) { setMessage(picked.error.message); return null; }
    if (picked.value === null) return null;

    const extension = picked.value.fileName.includes('.')
      ? picked.value.fileName.split('.').pop() ?? 'bin'
      : 'bin';
    const stored = await window.izh.store.put(picked.value.bytes, extension);
    if (!stored.ok) { setMessage(stored.error.message); return null; }

    return { hash: stored.value, fileName: picked.value.fileName };
  }, [setMessage]);

  return { save, attachFile };
}
