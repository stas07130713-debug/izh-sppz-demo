/**
 * Своё мероприятие в регламенте (ТЗ, Дополнение 5, часть Р5).
 *
 * Организация добавляет к нормативной библиотеке то, что принято у неё:
 * «проверка наличия инвентарной бирки рукава», «проверка дополнительной
 * пломбы». Такие работы попадают в чек-лист наравне с нормативными и так же
 * пишутся в журнал — источник влияет не на учёт, а на то, можно ли работу
 * отключить (часть Р2).
 */

import { useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { AnswerKind, FailureImpact, LocalDocument, RegulationActivity } from '@izh/contracts';
import { documentActiveOn } from '@izh/core';
import { SelectField } from './SelectField';

const ANSWER_KINDS: readonly { readonly kind: AnswerKind; readonly title: string }[] = [
  { kind: 'галочка', title: 'Галочка: выполнено или нет' },
  { kind: 'число', title: 'Числовое значение (давление, масса)' },
  { kind: 'текст', title: 'Текст' },
  { kind: 'выбор', title: 'Выбор из вариантов' },
];

const IMPACTS: readonly { readonly impact: FailureImpact; readonly title: string }[] = [
  { impact: 'не влияет', title: 'Не влияет на состояние' },
  { impact: 'требует внимания', title: 'Переводит в «требует внимания»' },
  { impact: 'неисправно', title: 'Переводит в «неисправно»' },
];

export interface AddActivityModalProps {
  readonly periodicityTitle: string;
  readonly documents: readonly LocalDocument[];
  /** Сегодняшняя дата: по ней отбираются действующие документы (часть Р6). */
  readonly today: string;
  readonly busy: boolean;
  readonly newId: () => string;
  readonly onClose: () => void;
  readonly onAdd: (activity: RegulationActivity) => void;
}

export function AddActivityModal(props: AddActivityModalProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [answerKind, setAnswerKind] = useState<AnswerKind>('галочка');
  const [unit, setUnit] = useState('');
  const [options, setOptions] = useState('');
  const [reference, setReference] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [successCriterion, setSuccessCriterion] = useState('');
  const [failureImpact, setFailureImpact] = useState<FailureImpact>('требует внимания');
  const [needsNote, setNeedsNote] = useState(false);
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const [needsDocument, setNeedsDocument] = useState(false);

  const canAdd = title.trim() !== '' && !props.busy;

  const add = (): void => {
    const chosen = props.documents.find((document) => document.id === documentId) ?? null;

    props.onAdd({
      id: props.newId(),
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      answerKind,
      options: answerKind === 'выбор'
        ? options.split(',').map((item) => item.trim()).filter((item) => item !== '')
        : [],
      unit: answerKind === 'число' && unit.trim() !== '' ? unit.trim() : null,
      required: true,
      // Своё мероприятие всегда помечается пользовательским или локальным: выдавать
      // его за нормативное требование нельзя — на нём стоит запрет отключения.
      sources: [{
        kind: chosen === null ? 'пользовательское' : 'локальный документ',
        reference: reference.trim() !== '' ? reference.trim() : chosen?.title ?? 'Требование организации',
        localDocumentId: chosen?.id ?? null,
      }],
      successCriterion: successCriterion.trim() === '' ? null : successCriterion.trim(),
      failureImpact,
      needsNote,
      needsPhoto,
      needsDocument,
    });
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Своё мероприятие — {props.periodicityTitle}</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        <label className="field">
          <span>Наименование процедуры</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Проверка наличия инвентарной бирки рукава"
          />
        </label>

        <label className="field">
          <span>Краткое описание</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Вид выполнения</span>
            <SelectField
              value={answerKind}
              options={ANSWER_KINDS.map((item) => ({ value: item.kind, title: item.title }))}
              onChange={(value) => setAnswerKind(value as AnswerKind)}
            />
          </label>

          {answerKind === 'число' && (
            <label className="field">
              <span>Единица измерения</span>
              <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="МПа, кг, %" />
            </label>
          )}

          {answerKind === 'выбор' && (
            <label className="field">
              <span>Варианты через запятую</span>
              <input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Да, Нет" />
            </label>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>Нормативное основание</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Регламент организации №12"
            />
          </label>
          <label className="field">
            <span>Локальный документ</span>
            {/* Отменённый приказ в списке не показывается: новое мероприятие
                нельзя обосновать документом, который уже не действует. Сам
                документ при этом никуда не делся — прежние мероприятия
                по-прежнему на него ссылаются. */}
            <SelectField
              value={documentId}
              placeholder="не выбран"
              options={props.documents
                .filter((document) => documentActiveOn(document, props.today))
                .map((document) => ({ value: document.id, title: document.title }))}
              onChange={setDocumentId}
            />
          </label>
        </div>

        <label className="field">
          <span>Критерий успешного выполнения</span>
          <input value={successCriterion} onChange={(event) => setSuccessCriterion(event.target.value)} />
        </label>

        <label className="field">
          <span>При отрицательном результате</span>
          <SelectField
            value={failureImpact}
            options={IMPACTS.map((item) => ({ value: item.impact, title: item.title }))}
            onChange={(value) => setFailureImpact(value as FailureImpact)}
          />
        </label>

        <h4>Что требовать при выполнении</h4>
        <label className="checkbox">
          <input type="checkbox" checked={needsNote} onChange={(event) => setNeedsNote(event.target.checked)} />
          <span className="small">Примечание обязательно</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={needsPhoto} onChange={(event) => setNeedsPhoto(event.target.checked)} />
          <span className="small">Фотография обязательна</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={needsDocument} onChange={(event) => setNeedsDocument(event.target.checked)} />
          <span className="small">Документ обязателен</span>
        </label>

        <div className="actions">
          <button type="button" className="primary" disabled={!canAdd} onClick={add}>
            Добавить в регламент
          </button>
        </div>

        <p className="muted small">
          Мероприятие войдёт в состав периодичности «{props.periodicityTitle}» и попадёт в чек-лист
          после выпуска новой версии регламента.
        </p>
      </div>
    </div>
  );
}
