/**
 * Акт проверки, прикладываемый к записи журнала (ТЗ, Дополнение 6).
 *
 * Не то же самое, что акт сторонней организации: тот подтверждает, кто
 * выполнял работы, и спрашивается только у подрядчика. Этот — что проверка
 * состоялась и с каким результатом; проверку водоисточника оформляют актом
 * независимо от того, своими силами её провели или подрядчиком, и предъявляют
 * потом именно его.
 *
 * Блок появляется только у тех работ, по которым акт положен: признак стоит у
 * правила, в данных, а не списком кодов в коде.
 */

import { useState } from 'react';
import type { InspectionAct } from '@izh/contracts';

export interface InspectionActState {
  readonly number: string;
  readonly date: string;
  readonly file: InspectionAct['file'] | null;
}

export const EMPTY_INSPECTION_ACT: InspectionActState = { number: '', date: '', file: null };

/** Готовый акт или null, если заполнено не всё. Частичный акт хранить нельзя. */
export function inspectionActFrom(state: InspectionActState): InspectionAct | null {
  if (state.number.trim() === '' || state.date === '' || state.file === null) return null;
  return { number: state.number.trim(), date: state.date, file: state.file };
}

/** Чего не хватает акту. Пустой акт — не ошибка: он обязателен не всегда. */
export function inspectionActErrors(state: InspectionActState): readonly string[] {
  const filled = state.number.trim() !== '' || state.date !== '' || state.file !== null;
  if (!filled) return [];
  const errors: string[] = [];
  if (state.number.trim() === '') errors.push('Не указан номер акта проверки');
  if (state.date === '') errors.push('Не указана дата акта проверки');
  if (state.file === null) errors.push('Не загружен файл акта проверки');
  return errors;
}

export interface InspectionActFieldsProps {
  readonly value: InspectionActState;
  readonly onChange: (value: InspectionActState) => void;
  readonly onError: (message: string) => void;
}

export function InspectionActFields(props: InspectionActFieldsProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const pick = async (): Promise<void> => {
    setBusy(true);
    try {
      const picked = await window.izh.openMaintenanceDocument();
      if (!picked.ok) { props.onError(picked.error.message); return; }
      if (picked.value === null) return;
      const extension = picked.value.fileName.includes('.')
        ? picked.value.fileName.split('.').pop() ?? 'bin'
        : 'bin';
      const stored = await window.izh.store.put(picked.value.bytes, extension);
      if (!stored.ok) { props.onError(stored.error.message); return; }
      props.onChange({ ...props.value, file: { hash: stored.value, fileName: picked.value.fileName } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="inspection-act">
      <h5>Акт проверки</h5>
      <div className="field-row">
        <label className="field">
          <span>Номер акта</span>
          <input value={props.value.number} onChange={(e) => props.onChange({ ...props.value, number: e.target.value })} />
        </label>
        <label className="field">
          <span>Дата акта</span>
          <input type="date" value={props.value.date} onChange={(e) => props.onChange({ ...props.value, date: e.target.value })} />
        </label>
      </div>
      <div className="document-picker">
        <button type="button" disabled={busy} onClick={() => void pick()}>Добавить акт проверки</button>
        <span className="muted small">{props.value.file?.fileName ?? 'акт не загружен'}</span>
        {props.value.file !== null && (
          <button type="button" className="link" onClick={() => props.onChange({ ...props.value, file: null })}>убрать</button>
        )}
      </div>
      <p className="muted small">
        Акт подтверждает, что проверка состоялась. Заполняется целиком или не заполняется вовсе —
        номер без файла в делах не найти.
      </p>
    </section>
  );
}
