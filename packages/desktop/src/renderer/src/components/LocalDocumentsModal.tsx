/**
 * Локальные нормативные документы организации (ТЗ, Дополнение 5, часть Р6).
 *
 * Слева перечень заведённых документов, справа карточка выбранного. Требование
 * заказчика прямое: у мероприятия должно быть видно основание, и «так решили»
 * основанием не считается — а приказ с номером и датой утверждения считается.
 *
 * Файл прикладывается в хранилище программы и хранится по хешу: абсолютных
 * путей пользователя в данных не бывает (AGENTS.md, «чего делать нельзя»).
 * Иначе документ терялся бы при переносе базы на другой компьютер.
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { LocalDocument } from '@izh/contracts';
import { documentActiveOn } from '@izh/core';
import { formatDateRu } from '../format';

export interface LocalDocumentsModalProps {
  readonly documents: readonly LocalDocument[];
  readonly busy: boolean;
  readonly today: string;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: (draft: DocumentDraft) => void;
  /** Выбор файла приказа: возвращает хеш в хранилище программы. */
  readonly onAttachFile: () => Promise<{ readonly hash: string; readonly fileName: string } | null>;
}

export interface DocumentDraft {
  readonly id: string | null;
  readonly title: string;
  readonly number: string;
  readonly approvedOn: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly organization: string;
  readonly department: string;
  readonly fileHash: string | null;
  readonly note: string;
}

const EMPTY: DocumentDraft = {
  id: null, title: '', number: '', approvedOn: '', effectiveFrom: '',
  effectiveTo: '', organization: '', department: '', fileHash: null, note: '',
};

function toDraft(document: LocalDocument): DocumentDraft {
  return {
    id: document.id,
    title: document.title,
    number: document.number ?? '',
    approvedOn: document.approvedOn ?? '',
    effectiveFrom: document.effectiveFrom ?? '',
    effectiveTo: document.effectiveTo ?? '',
    organization: document.organization ?? '',
    department: document.department ?? '',
    fileHash: document.fileHash,
    note: document.note ?? '',
  };
}

export function LocalDocumentsModal(props: LocalDocumentsModalProps): React.JSX.Element {
  const [draft, setDraft] = useState<DocumentDraft>(EMPTY);
  const [fileName, setFileName] = useState<string | null>(null);

  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  const pick = (document: LocalDocument): void => {
    setDraft(toDraft(document));
    setFileName(null);
  };

  const attach = async (): Promise<void> => {
    const stored = await props.onAttachFile();
    if (stored === null) return;
    set('fileHash', stored.hash);
    setFileName(stored.fileName);
  };

  const valid = draft.title.trim() !== '';

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal documents-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Локальные нормативные документы</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        {props.error !== null && <p className="banner error">{props.error}</p>}

        <div className="documents-body">
          <aside className="documents-list">
            <button type="button" className="type-row" onClick={() => { setDraft(EMPTY); setFileName(null); }}>
              + Завести документ
            </button>
            {props.documents.length === 0 ? (
              <p className="muted small">Документов пока нет.</p>
            ) : (
              props.documents.map((document) => {
                const active = documentActiveOn(document, props.today);
                return (
                  <button
                    key={document.id}
                    type="button"
                    className={document.id === draft.id ? 'type-row active' : 'type-row'}
                    onClick={() => pick(document)}
                  >
                    <span>{document.title}</span>
                    <small className="muted">
                      {document.number ?? 'без номера'}
                      {/* Недействующий документ прячется не насовсем: на него
                          ссылаются мероприятия, проведённые в своё время. */}
                      {!active && ' · не действует'}
                    </small>
                  </button>
                );
              })
            )}
          </aside>

          <div className="documents-editor">
            <label className="field">
              <span>Название</span>
              <input
                value={draft.title}
                placeholder="Инструкция о мерах пожарной безопасности"
                onChange={(event) => set('title', event.target.value)}
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Номер</span>
                <input value={draft.number} placeholder="15-ПБ" onChange={(event) => set('number', event.target.value)} />
              </label>
              <label className="field">
                <span>Утверждён</span>
                <input type="date" value={draft.approvedOn} onChange={(event) => set('approvedOn', event.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Действует с</span>
                <input type="date" value={draft.effectiveFrom} onChange={(event) => set('effectiveFrom', event.target.value)} />
              </label>
              <label className="field">
                <span>Действует по</span>
                <input type="date" value={draft.effectiveTo} onChange={(event) => set('effectiveTo', event.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Кем утверждён</span>
                <input value={draft.organization} placeholder="ООО «Пример»" onChange={(event) => set('organization', event.target.value)} />
              </label>
              <label className="field">
                <span>Подразделение</span>
                <input value={draft.department} placeholder="Служба охраны труда" onChange={(event) => set('department', event.target.value)} />
              </label>
            </div>

            <label className="field">
              <span>Примечание</span>
              <input value={draft.note} onChange={(event) => set('note', event.target.value)} />
            </label>

            <div className="field-row document-file">
              <button type="button" disabled={props.busy} onClick={() => { void attach(); }}>
                {draft.fileHash === null ? 'Приложить файл документа' : 'Заменить файл'}
              </button>
              <span className="muted small">
                {fileName ?? (draft.fileHash === null ? 'Файл не приложен' : 'Файл приложен ранее')}
              </span>
            </div>

            <p className="muted small">
              Документ не удаляется: на него ссылаются мероприятия, проведённые в своё время.
              Чтобы вывести его из действия, укажите дату окончания.
              {draft.effectiveTo !== '' && ` Сейчас указано: по ${formatDateRu(draft.effectiveTo)}.`}
            </p>

            {!valid && <p className="error">Укажите название документа.</p>}

            <div className="actions">
              <button type="button" className="primary" disabled={props.busy || !valid} onClick={() => props.onSave(draft)}>
                {draft.id === null ? 'Завести документ' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
