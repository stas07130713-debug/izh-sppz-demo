/**
 * Заведение объектов пачкой: партия одинаковых и перенос чужого журнала.
 *
 * Вынесено из главного экрана одной работой: оба случая заводят помногу, оба
 * упираются в одно и то же свойство хранилища и оба держат общую занятость.
 *
 * Главное правило здесь — **строго по одному вызову за раз**. Хранилище читает
 * файл, дописывает запись и сохраняет его целиком, без блокировки: параллельные
 * вызовы затёрли бы результаты друг друга. Поэтому оба действия идут циклом с
 * ожиданием ответа, а не `Promise.all`.
 *
 * Второе правило — занятость снимается в `finally`. Заведение помногу способно
 * сорваться на середине (файл повреждён, мост оборвался), и без `finally` окно
 * оставалось бы заблокированным до перезапуска программы.
 */

import { useState } from 'react';
import type { PixelPoint, PlanObject, TreeNode } from '@izh/contracts';
import { describeUnknown } from '@izh/contracts';
import { datesToActivities, placeObject, recordMaintenanceBatchSigned, type BatchSigner, updateObject } from '@izh/core';
import { maintenanceDeps, objectDeps } from './deps';
import { emptyExtinguisherProfile } from './components/ExtinguisherProfileFields';
import type { BatchCommonFields } from './components/BatchCreateModal';
import type { ImportedRow } from './components/JournalImportWizard';

/** Пустая карточка огнетушителя — только для огнетушителей, остальным null. */
export function newExtinguisherProfile(typeCode: string): PlanObject['extinguisherProfile'] {
  if (typeCode !== 'extinguisher' && !typeCode.startsWith('extinguisher-')) return null;
  return emptyExtinguisherProfile(typeCode);
}

export interface ObjectBatchInput {
  /** Узел, внутрь которого заводятся объекты. */
  readonly selected: TreeNode | null;
  readonly setMessage: (message: string) => void;
  /** Страж главного экрана: ведёт отмену и ловит сорвавшийся вызов. */
  readonly runCommand: <T>(label: string, action: () => Promise<T>) => Promise<T | null>;
  readonly reloadObjectLists: () => void;
  readonly reloadEvents: () => void;
}

export interface ObjectBatch {
  /** Идёт заведение: окна партии и переноса на это время заперты. */
  readonly busy: boolean;
  readonly createBatch: (
    typeCode: string,
    regNumbers: readonly string[],
    common: BatchCommonFields,
    positions: readonly (PixelPoint | null)[],
    signer: BatchSigner,
  ) => Promise<void>;
  /**
   * Один объект из очереди, размещаемый щелчком по плану.
   *
   * Занятость та же, что у партии: пока идёт запись, план щелчков не принимает,
   * иначе один номер лёг бы дважды. Возвращает созданный объект или null.
   */
  readonly placeOne: (
    typeCode: string,
    position: PixelPoint,
    regNumber: string,
    common: BatchCommonFields,
    signer: BatchSigner,
  ) => Promise<PlanObject | null>;
  /** Перенос записей из чужого журнала. `onDone` закрывает окно переноса. */
  /**
   * Перенести журнал.
   *
   * `signer` — кто заверяет перенос: его подпись встанет на каждую созданную
   * строку журнала. Без него переноса нет: запись журнала в этой программе не
   * заводится неподписанной.
   */
  readonly importJournal: (
    rows: readonly ImportedRow[],
    onDone: () => void,
    signer: BatchSigner,
  ) => Promise<void>;
}

export function useObjectBatch(input: ObjectBatchInput): ObjectBatch {
  const [busy, setBusy] = useState(false);
  const { selected, setMessage, runCommand, reloadObjectLists, reloadEvents } = input;

  const createBatch = async (
    typeCode: string,
    regNumbers: readonly string[],
    common: BatchCommonFields,
    positions: readonly (PixelPoint | null)[],
    signer: BatchSigner,
  ): Promise<void> => {
    if (selected === null) return;

    setBusy(true);
    try {
      for (let i = 0; i < regNumbers.length; i += 1) {
        const result = await placeObject(objectDeps, {
          nodeId: selected.id,
          typeCode,
          position: positions[i] ?? null,
          regNumber: regNumbers[i],
          ...common,
          extinguisherProfile: newExtinguisherProfile(typeCode),
          signer,
        });
        if (!result.ok) {
          setMessage(result.error.message);
          break;
        }
      }
    } catch (e) {
      setMessage(`Не удалось создать партию: ${describeUnknown(e)}`);
    } finally {
      setBusy(false);
    }
    reloadObjectLists();
  };

  const placeOne = async (
    typeCode: string,
    position: PixelPoint,
    regNumber: string,
    common: BatchCommonFields,
    signer: BatchSigner,
  ): Promise<PlanObject | null> => {
    if (selected === null) return null;

    setBusy(true);
    try {
      const result = await runCommand('Разместить объект из очереди', () => placeObject(objectDeps, {
        nodeId: selected.id,
        typeCode,
        position,
        regNumber,
        ...common,
        extinguisherProfile: newExtinguisherProfile(typeCode),
        signer,
      }));
      if (result === null) return null;
      if (!result.ok) { setMessage(result.error.message); return null; }

      reloadObjectLists();
      return result.value;
    } finally {
      // Снятие занятости — и после отказа, и после срыва: иначе план переставал
      // бы принимать щелчки, а очередь висела недоставленной.
      setBusy(false);
    }
  };

  /**
   * Переносит записи из чужого журнала.
   *
   * Объекты создаются без координат: место установки в старом журнале — текст,
   * а не точка на плане, поэтому записи попадают в «Требуют размещения», как и
   * требует ТЗ (часть 7.3). Даты превращаются в мероприятия — у нас дата это
   * событие в ленте истории, а не поле карточки (Д5).
   */
  const importJournal = async (
    rows: readonly ImportedRow[],
    onDone: () => void,
    signer: BatchSigner,
  ): Promise<void> => {
    if (selected === null) return;

    let created = 0;
    let failed = 0;
    /** Записи, которые создались, но что-то из их сведений записать не удалось. */
    const problems: string[] = [];

    setBusy(true);
    try {
      for (const row of rows) {
        const placed = await placeObject(objectDeps, {
          nodeId: selected.id,
          typeCode: row.typeCode,
          position: null,
          regNumber: row.regNumber,
          model: row.model,
          responsible: row.responsible,
          extinguisherProfile: newExtinguisherProfile(row.typeCode),
          signer,
        });
        if (!placed.ok) {
          failed += 1;
          continue;
        }
        created += 1;

        // Состояние и примечание дописываются отдельно от создания. Результат
        // проверяется: молчаливая потеря здесь означала бы, что пользователю
        // сказали «перенесено», а часть сведений не записалась.
        if (row.technicalState !== 'не определено' || row.note !== null) {
          const updated = await updateObject(objectDeps, {
            id: placed.value.id,
            ...(row.technicalState !== 'не определено' ? { technicalState: row.technicalState } : {}),
            ...(row.note !== null ? { note: row.note } : {}),
          });
          if (!updated.ok) {
            problems.push(`${row.regNumber ?? 'без номера'}: ${updated.error.message}`);
          }
        }

        // Даты из чужого журнала становятся мероприятиями. Пишутся одной
        // операцией: перенос не должен оставлять объект с половиной истории.
        const activities = datesToActivities(row.typeCode, row.lastCheck, row.lastRecharge, row.checkHeader);

        /*
         * Неперенесённая дата называется вслух.
         *
         * Дата из журнала не всегда ложится в работу: колонка может называть
         * периодичность, которой в регламенте вида нет («Квартальная проверка» у
         * огнетушителя, если организация не включила локальный осмотр). Записать
         * вместо неё соседнюю работу нельзя — это объявило бы выполненным то,
         * чего не было. Но и промолчать нельзя: человек считал бы историю
         * перенесённой.
         */
        const expected = (row.lastCheck === null ? 0 : 1) + (row.lastRecharge === null ? 0 : 1);
        if (activities.length < expected) {
          problems.push(
            `${row.regNumber ?? 'без номера'}: дата из журнала не перенесена — `
            + 'в регламенте этого вида оборудования нет такой работы',
          );
        }
        if (activities.length > 0) {
          const recorded = await recordMaintenanceBatchSigned(
            maintenanceDeps,
            activities.map((activity) => ({
              objectId: placed.value.id,
              activityCode: activity.activityCode,
              performedOn: activity.performedOn,
              result: 'выполнено' as const,
              checklist: [],
              note: 'Перенесено из существующего журнала',
            })),
            signer,
          );
          if (!recorded.ok) {
            problems.push(`${row.regNumber ?? 'без номера'}: ${recorded.error.message}`);
          }
        }
      }
    } catch (e) {
      setMessage(`Перенос прервался: ${describeUnknown(e)}`);
    } finally {
      setBusy(false);
    }

    onDone();
    reloadObjectLists();
    reloadEvents();

    const summary =
      failed === 0
        ? `Перенесено записей: ${created}. Они в журнале и в перечне требующих размещения.`
        : `Перенесено записей: ${created}, не удалось: ${failed}.`;
    // О неполном переносе говорим прямо: «перенесено 30» при потерянных датах
    // ввело бы в заблуждение — пользователь считал бы историю перенесённой.
    setMessage(
      problems.length === 0
        ? summary
        : `${summary} У ${problems.length} записей перенеслись не все сведения: ${problems.slice(0, 3).join('; ')}` +
          (problems.length > 3 ? ' и другие.' : '.'),
    );
  };

  return { busy, createBatch, placeOne, importJournal };
}
