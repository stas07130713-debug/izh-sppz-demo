/**
 * Чек-лист системы пишет каждому элементу его собственные работы.
 *
 * Заказчик: «при выборе систем пожарной автоматики в чек-листе пишет ошибку,
 * что выбранное мероприятие не применимо к данному оборудованию». Причина:
 * система проверяется целиком, а регламенты внутри неё разные — у прибора свои
 * работы, у извещателя свои. В журнал уходили работы того элемента, с чьей
 * карточки открыли чек-лист, и запись отклонялась целиком.
 *
 * Здесь проверяется отбор, который делает главный экран перед записью: он
 * спрашивает тот же источник, которым нарисован журнал.
 */

import { describe, expect, it } from 'vitest';
import type { PlanObject } from '@izh/contracts';
import type { ActivityRule, ActivityScheduleSource } from '@izh/core';

const PERFORMED_ON = '2026-08-26';

function object(id: string, typeCode: string): PlanObject {
  return { id, typeCode, archivedAt: null } as unknown as PlanObject;
}

function rule(activityCode: string, title: string): ActivityRule {
  return {
    activityCode, title, periodicityMonths: 12, checklist: [],
    ndReference: 'СП 484.1311500.2020', needsVerification: false,
  };
}

/** У прибора свои работы, у извещателя свои — как в настоящем регламенте. */
const SOURCE: ActivityScheduleSource = {
  rulesFor: (item) => (item.typeCode === 'control-panel'
    ? [rule('проверка-ппку', 'Проверка прибора'), rule('акб', 'Проверка АКБ')]
    : [rule('чистка-извещателя', 'Чистка извещателя')]),
  nextDueOn: () => null,
};

/**
 * Отбор работ по элементам — тот же, что делает главный экран.
 *
 * Вынесен сюда как есть, а не подсмотрен из разметки: проверяется правило, а
 * не то, как оно записано в JSX.
 */
function applicableBatch(
  objects: readonly PlanObject[],
  entries: readonly { readonly activityCode: string }[],
  source: ActivityScheduleSource,
): readonly { readonly objectId: string; readonly activityCode: string }[] {
  return objects.flatMap((item) => {
    const codes = new Set(source.rulesFor(item, PERFORMED_ON).map((applicable) => applicable.activityCode));
    return entries
      .filter((entry) => codes.has(entry.activityCode))
      .map((entry) => ({ objectId: item.id, activityCode: entry.activityCode }));
  });
}

const PANEL = object('ППКУ-1', 'control-panel');
const DETECTOR_A = object('ИПД-1', 'smoke-detector');
const DETECTOR_B = object('ИПД-2', 'smoke-detector');

describe('чек-лист системы', () => {
  it('работа прибора не пишется извещателям', () => {
    const batch = applicableBatch(
      [PANEL, DETECTOR_A, DETECTOR_B],
      [{ activityCode: 'проверка-ппку' }],
      SOURCE,
    );

    expect(batch).toEqual([{ objectId: 'ППКУ-1', activityCode: 'проверка-ппку' }]);
  });

  it('работа извещателя пишется извещателям, а не прибору', () => {
    const batch = applicableBatch(
      [PANEL, DETECTOR_A, DETECTOR_B],
      [{ activityCode: 'чистка-извещателя' }],
      SOURCE,
    );

    expect(batch.map((item) => item.objectId)).toEqual(['ИПД-1', 'ИПД-2']);
  });

  it('отметив обе работы, каждый элемент получает свою', () => {
    const batch = applicableBatch(
      [PANEL, DETECTOR_A],
      [{ activityCode: 'проверка-ппку' }, { activityCode: 'чистка-извещателя' }],
      SOURCE,
    );

    expect(batch).toEqual([
      { objectId: 'ППКУ-1', activityCode: 'проверка-ппку' },
      { objectId: 'ИПД-1', activityCode: 'чистка-извещателя' },
    ]);
  });

  it('работа, не подходящая никому, даёт пустой пакет, а не отказ', () => {
    // Пустой пакет главный экран ловит сам и объясняет словами. Раньше сюда
    // уходила заведомо неприменимая запись, и ядро отвечало отказом на всё.
    const batch = applicableBatch([DETECTOR_A], [{ activityCode: 'проверка-ппку' }], SOURCE);
    expect(batch).toEqual([]);
  });
});
