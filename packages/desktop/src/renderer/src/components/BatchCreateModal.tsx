/**
 * Окно «Создать несколько» — групповое создание объектов правой кнопкой по
 * элементу библиотеки.
 *
 * Три способа размещения: по щелчку (пользователь ставит точки на плане одну
 * за другой), в помещение (расстановка по контуру, как на плане эвакуации,
 * с ручной правкой потом) и без размещения (объекты сразу в «Требуют
 * размещения»). Для склада доступен только последний — там нет плана.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 6.3.
 */

import { useMemo, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { PlanObject, Room } from '@izh/contracts';
import {
  duplicateRegNumbers,
  elementByCode,
  extinguisherManufacturerName,
  extinguisherManufacturersForType,
  extinguisherModelsForManufacturer,
  extinguisherReferenceByManufacturerAndModel,
  generateRegNumbers,
  modelsFor,
  type PlanKind,
} from '@izh/core';
import { familyOptionsFor } from './equipment-family-options';
import { SelectField } from './SelectField';
import { endSentence } from '../format';

export type PlacementMode = 'click' | 'room' | 'none';

export interface BatchCommonFields {
  readonly model: string | null;
  readonly manufacturer: string | null;
  readonly commissionedOn: string | null;
  readonly serviceLifeYears: number | null;
  readonly responsible: string | null;
  readonly roomId: string | null;
}

export interface BatchCreateModalProps {
  readonly typeCode: string;
  readonly planKind: PlanKind;
  readonly hasPlan: boolean;
  readonly rooms: readonly Room[];
  /** Все объекты организации — по ним проверяются занятые учётные номера. */
  readonly existingObjects: readonly PlanObject[];
  readonly siteId: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  /**
   * Вправе ли этот человек подписывать.
   *
   * Кто подписывать не вправе, тот и оборудование не заводит: строка журнала
   * без подписи в этой программе не появляется (63-ФЗ, статья 5 часть 2 —
   * подпись подтверждает, что её поставил определённый человек).
   */
  readonly canSign: boolean;
  /** Чем объяснить отказ, если подписывать нельзя. */
  readonly signHint: string | null;
  /** Кто подпишет заведение. Показывается, чтобы человек видел, чьей подписью. */
  readonly signerName: string | null;
  /** Способы «без размещения» и «в помещение» создают всё сразу. */
  readonly onCreateNow: (typeCode: string, regNumbers: readonly string[], common: BatchCommonFields, roomOutlinePlacement: boolean) => void;
  /** Способ «по щелчку» передаёт очередь наружу — плана ставит точки сам. */
  readonly onStartClickPlacement: (typeCode: string, regNumbers: readonly string[], common: BatchCommonFields) => void;
}

export function BatchCreateModal(props: BatchCreateModalProps): React.JSX.Element {
  const element = elementByCode(props.typeCode);
  const family = familyOptionsFor(props.typeCode);
  const [selectedTypeCode, setSelectedTypeCode] = useState(props.typeCode);
  const selectedElement = elementByCode(selectedTypeCode);
  const extinguisherBatch = props.typeCode === 'extinguisher' || props.typeCode.startsWith('extinguisher-');
  const [manufacturerChoice, setManufacturerChoice] = useState('');
  /** Каскадный справочник модели по виду (ТЗ, Дополнение 3, часть К6). */
  const models = extinguisherBatch
    ? manufacturerChoice !== '' && manufacturerChoice !== OTHER_MANUFACTURER
      ? extinguisherModelsForManufacturer(manufacturerChoice, selectedTypeCode)
      : []
    : modelsFor(selectedTypeCode);

  const [count, setCount] = useState(1);
  const [prefix, setPrefix] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [step, setStep] = useState<1 | 0.1 | 0.01>(1);

  const [model, setModel] = useState('');
  const [manualModel, setManualModel] = useState(false);
  const [manufacturer, setManufacturer] = useState('');
  const [commissionedOn, setCommissionedOn] = useState('');
  const [serviceLife, setServiceLife] = useState('');
  const [responsible, setResponsible] = useState('');
  const [roomId, setRoomId] = useState('');
  const reference = extinguisherReferenceByManufacturerAndModel(manufacturer, model);

  const roomsAvailable = props.planKind === 'floor' && props.rooms.length > 0;
  const selectedRoom = props.rooms.find((room) => room.id === roomId) ?? null;
  const canPlaceInRoom = roomsAvailable && selectedRoom !== null && selectedRoom.outline !== null;
  const canPlaceByClick = props.hasPlan && props.planKind !== 'storage';

  const [mode, setMode] = useState<PlacementMode>('none');
  const effectiveMode: PlacementMode = props.planKind === 'storage' ? 'none' : mode;
  const numberingPrefix = extinguisherBatch
    ? automaticExtinguisherPrefix(model, selectedElement?.mark ?? 'ОГ')
    : prefix;

  const regNumbers = useMemo(
    () => generateRegNumbers({ prefix: numberingPrefix, startNumber, step }, count),
    [numberingPrefix, startNumber, step, count],
  );
  const duplicates = useMemo(
    () => duplicateRegNumbers(props.existingObjects, props.siteId, regNumbers),
    [props.existingObjects, props.siteId, regNumbers],
  );

  const common: BatchCommonFields = {
    model: model.trim() === '' ? null : model,
    manufacturer: manufacturer.trim() === '' ? null : manufacturer,
    commissionedOn: commissionedOn.trim() === '' ? null : commissionedOn,
    serviceLifeYears: serviceLife.trim() === '' ? null : Number(serviceLife),
    responsible: responsible.trim() === '' ? null : responsible,
    roomId: roomId === '' ? null : roomId,
  };

  const canSubmit = count > 0 && regNumbers.length === new Set(regNumbers).size
    && duplicates.length === 0 && props.canSign;

  const submit = (): void => {
    if (effectiveMode === 'click') {
      props.onStartClickPlacement(selectedTypeCode, regNumbers, common);
      return;
    }
    props.onCreateNow(selectedTypeCode, regNumbers, common, effectiveMode === 'room');
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Создать несколько: {element?.title ?? props.typeCode}</h3>
          <button type="button" className="link" onClick={props.onClose}>
            закрыть ✕
          </button>
        </div>

        <label className="field">
          <span>Количество</span>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(Math.max(1, Number(event.target.value)))}
          />
        </label>

        <h4>Схема нумерации</h4>
        <div className="field-row">
          {!extinguisherBatch && (
            <label className="field">
              <span>Префикс</span>
              <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="ИПД-" />
            </label>
          )}
          <label className="field">
            <span>Начальный номер</span>
            <input type="number" value={startNumber} onChange={(event) => setStartNumber(Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Шаг</span>
            <SelectField
              value={String(step)}
              options={[
                { value: '1', title: '1' },
                { value: '0.1', title: '0.1' },
                { value: '0.01', title: '0.01' },
              ]}
              onChange={(value) => setStep(stepFromValue(value))}
            />
          </label>
        </div>
        {extinguisherBatch && (
          <p className="muted small">
            Префикс номера берётся автоматически из выбранной марки/модели огнетушителя.
          </p>
        )}

        <div className="numbering-preview">
          {regNumbers.map((number) => (
            <span key={number} className={duplicates.includes(number) ? 'badge error' : 'badge'}>
              {number}
            </span>
          ))}
        </div>
        {duplicates.length > 0 && (
          <p className="small error">Уже заняты: {duplicates.join(', ')}. Измените начальный номер или шаг.</p>
        )}

        <h4>Общие характеристики</h4>
        {family !== null && (
          <label className="field">
            <span>{family.label}</span>
            <SelectField
              value={selectedTypeCode}
              options={family.options.map((option) => ({ value: option.code, title: option.title }))}
              onChange={(nextTypeCode) => {
                const manufacturerStillAllowed = manufacturerChoice === ''
                  || manufacturerChoice === OTHER_MANUFACTURER
                  || extinguisherManufacturersForType(nextTypeCode).some((option) => option.id === manufacturerChoice);
                setSelectedTypeCode(nextTypeCode);
                setModel('');
                setManualModel(false);
                setServiceLife('');
                if (!manufacturerStillAllowed) {
                  setManufacturerChoice('');
                  setManufacturer('');
                }
              }}
            />
          </label>
        )}
        {extinguisherBatch && (
          <div className="field-row">
            <label className="field">
              <span>Изготовитель</span>
              <SelectField
                value={manufacturerChoice}
                placeholder="не выбрано"
                options={[
                  ...extinguisherManufacturersForType(selectedTypeCode)
                    .map((option) => ({ value: option.id, title: option.name })),
                  { value: OTHER_MANUFACTURER, title: 'Другое' },
                ]}
                onChange={(nextChoice) => {
                  setManufacturerChoice(nextChoice);
                  setModel('');
                  setManualModel(nextChoice === OTHER_MANUFACTURER);
                  setServiceLife('');
                  if (nextChoice === '' || nextChoice === OTHER_MANUFACTURER) {
                    setManufacturer('');
                    return;
                  }
                  setManufacturer(extinguisherManufacturerName(nextChoice) ?? '');
                }}
              />
            </label>
            {manufacturerChoice === OTHER_MANUFACTURER && (
              <label className="field">
                <span>Изготовитель вручную</span>
                <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
              </label>
            )}
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span>Марка, модель</span>
            {models.length > 0 && !manualModel ? (
              <SelectField
                value={model}
                placeholder="не выбрано"
                options={[
                  ...models.map((option) => ({ value: option.code, title: option.title })),
                  { value: OTHER_MODEL, title: 'Другая модель' },
                ]}
                onChange={(nextModel) => {
                  if (nextModel === OTHER_MODEL) {
                    setModel('');
                    setManualModel(true);
                    setServiceLife('');
                    return;
                  }
                  const nextReference = extinguisherReferenceByManufacturerAndModel(manufacturer, nextModel);
                  setModel(nextModel);
                  setServiceLife(nextReference?.serviceLifeYears == null ? '' : String(nextReference.serviceLifeYears));
                }}
              />
            ) : (
              <input
                value={model}
                disabled={extinguisherBatch && manufacturerChoice === ''}
                onChange={(event) => setModel(event.target.value)}
                placeholder={extinguisherBatch && manufacturerChoice === '' ? 'сначала выберите изготовителя' : undefined}
              />
            )}
          </label>
          {!extinguisherBatch && <label className="field">
            <span>Изготовитель</span>
            <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
          </label>}
        </div>
        <div className="field-row">
          <label className="field">
            <span>Введены в эксплуатацию</span>
            <input type="date" value={commissionedOn} onChange={(event) => setCommissionedOn(event.target.value)} />
          </label>
          <label className="field">
            <span>Срок службы по паспорту, лет</span>
            <input value={serviceLife} onChange={(event) => setServiceLife(event.target.value)} placeholder={reference?.serviceLifeYears == null ? 'не указан' : `${reference.serviceLifeYears} лет`} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Ответственный</span>
            <input value={responsible} onChange={(event) => setResponsible(event.target.value)} />
          </label>
          {roomsAvailable && (
            <label className="field">
              <span>Помещение</span>
              <SelectField
                value={roomId}
                placeholder="не указано"
                options={props.rooms.map((room) => ({ value: room.id, title: room.name }))}
                onChange={setRoomId}
              />
            </label>
          )}
        </div>

        <h4>Способ размещения</h4>
        {props.planKind === 'storage' ? (
          <p className="muted small">На складе координат нет: объекты сразу попадут в журнал склада.</p>
        ) : (
          <div className="placement-modes">
            <label className="checkbox">
              <input type="radio" checked={mode === 'none'} onChange={() => setMode('none')} />
              <span className="small">Без размещения — встанут в «Требуют размещения»</span>
            </label>
            <label className="checkbox">
              <input
                type="radio"
                checked={mode === 'click'}
                disabled={!canPlaceByClick}
                onChange={() => setMode('click')}
              />
              <span className="small">
                По щелчку — ставить на плане одно за другим
                {!canPlaceByClick && ' (нужна загруженная подложка)'}
              </span>
            </label>
            <label className="checkbox">
              <input
                type="radio"
                checked={mode === 'room'}
                disabled={!canPlaceInRoom}
                onChange={() => setMode('room')}
              />
              <span className="small">
                В помещение — расставить по контуру стен
                {props.planKind !== 'floor' && ' (доступно только на этаже)'}
                {props.planKind === 'floor' && !roomsAvailable && ' (на этаже ещё нет помещений)'}
                {roomsAvailable && !canPlaceInRoom && ' (выберите помещение, отмеченное на плане)'}
              </span>
            </label>
          </div>
        )}

        {/*
          * Кто подпишет заведение.
          *
          * Заказчик: «при заведении нового огнетушителя или элемента... должна
          * ставиться ПЭП». Пароль спрашивается следом, отдельным окном, и один
          * раз на всю партию: подпись подтверждает, что подписал определённый
          * человек (63-ФЗ, статья 5 часть 2), а не то, сколько раз он нажал
          * кнопку.
          */}
        <div className="import-sign">
          {props.canSign ? (
            <p className="muted small">
              {effectiveMode === 'click'
                ? 'Каждая строка, поставленная на план, будет подписана простой электронной подписью'
                : 'Каждая созданная строка журнала будет подписана простой электронной подписью'}
              {props.signerName === null ? '.' : endSentence(`: ${props.signerName}`)}
            </p>
          ) : (
            <p className="small warn">
              {props.signHint ?? 'Заводить оборудование может только тот, кто вправе подписать его появление в журнале.'}
            </p>
          )}
        </div>

        <div className="actions">
          <button type="button" onClick={props.onClose} disabled={props.busy}>
            Отмена
          </button>
          <button
            type="button"
            className="primary"
            disabled={props.busy || !canSubmit}
            onClick={submit}
          >
            {effectiveMode === 'click' ? 'Подписать и начать расстановку' : `Подписать и создать: ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function stepFromValue(value: string): 1 | 0.1 | 0.01 {
  if (value === '0.1') return 0.1;
  if (value === '0.01') return 0.01;
  return 1;
}

function automaticExtinguisherPrefix(model: string, fallbackMark: string): string {
  const trimmed = model.trim();
  if (trimmed !== '') return `${trimmed.split(/\s+/)[0] ?? trimmed}-`;
  return `${fallbackMark}-`;
}

const OTHER_MANUFACTURER = '__other__';
const OTHER_MODEL = '__other_model__';
