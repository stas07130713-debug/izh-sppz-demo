/**
 * Огнетушащее вещество, заряд и ранг тушения в карточке огнетушителя.
 *
 * Ранг вручную не вводят. Он однозначно следует из вида огнетушителя и массы
 * (объёма) заряда: вспомогательная таблица наименьших зарядов называет для каждой строки
 * наименьший заряд по маркам, и прочитанная в обратную сторону она даёт ранг.
 * Требовать от человека переписывать с этикетки то, что программа выводит из
 * уже введённого, — лишняя работа и лишняя возможность ошибиться.
 *
 * Поэтому здесь спрашивается только то, чего программа ещё не знает:
 *
 *   вид ОТВ + заряд + исполнение  →  ранг тушения
 *
 * Вид ОТВ у порошкового, углекислотного и прочих уточнённых огнетушителей
 * следует из самого вида изделия, а заряд — из обозначения модели.
 *
 * Такие графы здесь **не показываются вовсе**. Сначала их выводили значением
 * с подписью «следует из вида изделия», но заказчик справедливо назвал это
 * тем же дублированием: вид изделия и модель стоят выше, в той же карточке,
 * и повторять их числом ниже незачем. Откуда взялись вещество и заряд,
 * сказано одной строкой у самого ранга — там, где это и нужно знать.
 *
 * Спрашивают их только там, где вычитать неоткуда: общий вид «Огнетушитель»
 * без названного вещества, своя модель вроде «Буран-8» или пустая графа
 * модели.
 *
 * Вписать ранг с паспорта всё же можно, и такой ранг главнее вычисленного:
 * изготовитель подтверждает испытаниями то, чего в общей таблице нет — скажем,
 * класс E у воздушно-эмульсионных. Но это отдельное действие, а не обязанность.
 */

import { useState } from 'react';
import type { ExtinguisherAgent, ExtinguisherProfile } from '@izh/contracts';
import {
  agentFromModel, agentOfType, chargeFromModel, formatFireRank, isEmptyRank, rankOfExtinguisher,
} from '@izh/core';
import { SelectField } from './SelectField';

export interface ExtinguisherRankFieldsProps {
  readonly typeCode: string;
  /** Обозначение модели: из него виден заряд — «ОП-4» это четыре килограмма. */
  readonly model: string | null;
  readonly value: ExtinguisherProfile;
  readonly onChange: <K extends keyof ExtinguisherProfile>(key: K, value: ExtinguisherProfile[K]) => void;
}

const AGENTS: readonly ExtinguisherAgent[] = [
  'вода', 'вода с добавками', 'пена', 'порошок', 'углекислота', 'хладон', 'другое',
];

/**
 * Чем меряют заряд у этого вещества.
 *
 * Порошок и газы — килограммами, водные — литрами. Так же они записаны в
 * таблице 3, и сравнивать заряд с нормой можно только в её единицах.
 */
export function chargeUnitFor(agent: ExtinguisherAgent | null): 'кг' | 'л' | null {
  if (agent === null) return null;
  if (agent === 'порошок' || agent === 'углекислота' || agent === 'хладон') return 'кг';
  if (agent === 'вода' || agent === 'вода с добавками' || agent === 'пена') return 'л';
  return null;
}

function numberOrNull(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
}

export function ExtinguisherRankFields(props: ExtinguisherRankFieldsProps): React.JSX.Element {
  const profile = props.value;
  const [byPassport, setByPassport] = useState(profile.fireRating !== null);
  const { rank, fromCard } = rankOfExtinguisher(props.typeCode, profile);
  const unit = profile.chargeUnit ?? chargeUnitFor(profile.agent);
  /**
   * Вещество названо самим видом изделия или обозначением модели.
   *
   * «Огнетушитель порошковый» говорит это видом, «ОП-5» — обозначением. И то и
   * другое человек уже написал, и спрашивать вещество третий раз незачем.
   * Вид «Огнетушитель» без уточнения подвида — обычное дело: его ставит сама
   * программа при переносе журнала и при укладке значка на план.
   */
  const impliedAgent = agentOfType(props.typeCode) ?? agentFromModel(props.model);
  /**
   * Заряд, названный обозначением модели.
   *
   * Заказчик: «в карточке огнетушителя вообще не должно быть повторений в
   * определении объёма». И верно: «ОП-4» — это четыре килограмма, и
   * спрашивать их второй раз значит просить переписать то, что уже
   * написано, — а заодно заводить второе место, где то же число может
   * оказаться другим.
   *
   * Поле ввода остаётся только там, где вычитать неоткуда: своя модель,
   * набранная руками, или пустая графа модели.
   */
  const impliedCharge = chargeFromModel(props.model);

  const shown = rank === null || isEmptyRank(rank) ? null : formatFireRank(rank);

  /** Из чего посчитан ранг: «порошку, 5 кг» — то, что иначе просило бы своих граф. */
  const basis = [
    profile.agent,
    profile.nominalCharge === null ? null : `${profile.nominalCharge}${unit === null ? '' : ` ${unit}`}`,
  ].filter((part) => part !== null && part !== '').join(', ');

  return (
    <>
      <div className="field-row">
        {impliedAgent === null && (
        <SelectField
          label="Огнетушащее вещество"
          value={profile.agent ?? ''}
          options={AGENTS.map((agent) => ({ value: agent, title: agent }))}
          placeholder="не выбрано"
          onChange={(value) => {
            const agent = value === '' ? null : value as ExtinguisherAgent;
            props.onChange('agent', agent);
            // Единица идёт за веществом: порошок в литрах и вода в
            // килограммах — не опечатка пользователя, а наша недоработка.
            const next = chargeUnitFor(agent);
            if (next !== null && profile.chargeUnit !== next) props.onChange('chargeUnit', next);
          }}
        />
        )}
        {impliedCharge === null && (
        <label className="field">
          <span>Заряд ОТВ{unit === null ? '' : `, ${unit}`}</span>
          <input
            inputMode="decimal"
            value={profile.nominalCharge === null ? '' : String(profile.nominalCharge)}
            onChange={(event) => props.onChange('nominalCharge', numberOrNull(event.target.value))}
            placeholder="например, 4"
          />
        </label>
        )}
        <SelectField
          label="Исполнение"
          value={profile.execution ?? ''}
          options={[
            { value: 'переносной', title: 'переносной' },
            { value: 'передвижной', title: 'передвижной' },
          ]}
          placeholder="переносной"
          onChange={(value) => props.onChange(
            'execution',
            value === '' ? null : value as ExtinguisherProfile['execution'],
          )}
        />
      </div>

      {/*
        * Из чего посчитан ранг — одной строкой у самого ранга.
        *
        * Это и есть то место, где вещество и заряд нужно знать. Отдельных
        * граф под них нет: вид изделия и модель стоят выше в той же карточке.
        */}
      <div className="rank-line">
        <strong className="small">Ранг тушения:</strong>
        <output className="rank-value">{shown ?? 'не определён'}</output>
        <span className="muted small">
          {shown === null
            ? 'Ранг посчитается сам: назовите вид огнетушителя и его модель либо заряд. Точный ранг подтверждает паспорт изделия — его можно вписать.'
            : fromCard
              ? 'взят из паспорта изделия'
              : `посчитан по виду и заряду (${basis}); паспорт изделия главнее — впишите его ранг, если он выше`}
        </span>
      </div>

      {byPassport ? (
        <label className="field">
          <span>Ранг по паспорту изделия</span>
          <input
            value={profile.fireRating ?? ''}
            onChange={(event) => props.onChange('fireRating', event.target.value === '' ? null : event.target.value)}
            placeholder="2A, 55B, C, E"
          />
        </label>
      ) : (
        <button
          type="button"
          className="link"
          onClick={() => setByPassport(true)}
        >
          вписать ранг по паспорту изделия
        </button>
      )}
    </>
  );
}
