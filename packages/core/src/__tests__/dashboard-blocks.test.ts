/**
 * Каталог блоков дашборда (ТЗ, Дополнение 6, часть С50).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@izh/contracts';
import {
  DASHBOARD_BLOCKS,
  RECOMMENDED_DASHBOARD_BLOCKS,
  dashboardBlock,
  normalizeDashboardBlocks,
} from '../dashboard/dashboard-blocks.js';
import { incompleteCards, missingCardFields } from '../objects/card-completeness.js';
import {
  countInStorage, countNeedingPlacement, needsPlacement, storageNodeIds,
} from '../objects/storage-placement.js';

describe('каталог блоков', () => {
  it('названия блоков не повторяются', () => {
    const ids = DASHBOARD_BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('рекомендуемый состав собран из существующих блоков', () => {
    for (const id of RECOMMENDED_DASHBOARD_BLOCKS) {
      expect(`${id}: ${dashboardBlock(id) === null ? 'нет такого блока' : 'есть'}`).toBe(`${id}: есть`);
    }
  });

  it('умолчание настроек совпадает с рекомендуемым составом', () => {
    // Контракты не зависят от ядра, поэтому список умолчаний записан в них
    // отдельно. Разойтись эти два списка не должны: пользователь, нажавший
    // «вернуть рекомендуемые», получил бы не то, что видит новый пользователь.
    expect(DEFAULT_APP_SETTINGS.dashboardBlocks).toEqual(RECOMMENDED_DASHBOARD_BLOCKS);
  });
});

describe('приведение сохранённого состава', () => {
  it('незнакомые названия отбрасываются', () => {
    // Настройки переживают обновление программы: блок могли переименовать или
    // убрать, и падать из-за этого при открытии дашборда нельзя.
    expect(normalizeDashboardBlocks(['показатель-всего', 'блок-которого-нет'])).toEqual(['показатель-всего']);
  });

  it('повторы схлопываются, порядок сохраняется', () => {
    expect(normalizeDashboardBlocks(['график-состояние', 'показатель-всего', 'график-состояние']))
      .toEqual(['график-состояние', 'показатель-всего']);
  });

  it('пустой состав остаётся пустым, а не подменяется рекомендуемым', () => {
    // Выключить всё — законное желание: подменять его «полезным» набором
    // значило бы не слушаться настройки.
    expect(normalizeDashboardBlocks([])).toEqual([]);
  });
});

describe('обновление состава', () => {
  /*
   * Прежний состав по умолчанию. Записан здесь буквально, а не взят из кода:
   * тест обязан заметить, если этот список однажды подправят — тогда у людей,
   * ничего не менявших, дашборд молча перестанет обновляться.
   */
  const previousDefault = [
    'показатель-всего', 'показатель-норма', 'показатель-скоро', 'показатель-просрочено',
    'показатель-нет-данных', 'показатель-не-размещено', 'график-состояние', 'график-разделы',
    'список-просрочено', 'список-работы-7', 'список-системы',
  ];

  it('нетронутый прежний состав заменяется новым рекомендуемым', () => {
    expect(normalizeDashboardBlocks(previousDefault)).toEqual(RECOMMENDED_DASHBOARD_BLOCKS);
  });

  /*
   * Состав, который сам был рекомендуемым между двумя обновлениями.
   *
   * Пока сравнивали с единственным прежним умолчанием, второе обновление
   * подряд не доходило: в настройках лежал состав, который уже не был
   * «прежним», но ещё не стал новым, — и дашборд оставался старым, сколько
   * его ни правь. Заказчик так и сказал: «дашборд, по-моему, не исправил».
   */
  const previousRecommended = [
    'показатель-всего', 'показатель-норма', 'показатель-скоро', 'показатель-просрочено',
    'показатель-неисправно', 'показатель-не-размещено', 'график-состояние', 'график-системы',
    'график-динамика', 'список-места', 'список-проблемные', 'список-работы-7',
    'список-просрочено', 'список-неисправности',
  ];

  it('промежуточный рекомендуемый состав тоже обновляется', () => {
    expect(normalizeDashboardBlocks(previousRecommended)).toEqual(RECOMMENDED_DASHBOARD_BLOCKS);
  });

  it('нынешний рекомендуемый состав остаётся собой', () => {
    // Иначе обновление зациклилось бы на самом себе.
    expect(normalizeDashboardBlocks([...RECOMMENDED_DASHBOARD_BLOCKS]))
      .toEqual(RECOMMENDED_DASHBOARD_BLOCKS);
  });

  it('собранный вручную состав не трогается', () => {
    // Достаточно одного отличия от прежнего умолчания — человек здесь был.
    const mine = previousDefault.filter((id) => id !== 'график-разделы');
    expect(normalizeDashboardBlocks(mine)).toEqual(mine);
  });
});

describe('карточки, требующие заполнения', () => {
  /*
   * Колокольчик отвечает на вопрос «что где-то ждёт меня». «Требуют заполнения»
   * — это карточки, которыми нельзя пользоваться: без учётного номера единицу
   * не найти в журнале, без даты ввода не посчитать ни один срок, без
   * ответственного не с кого спрашивать.
   */
  const base = {
    id: 'o1', siteId: 's', nodeId: 'n', typeCode: 'extinguisher',
    regNumber: '1', model: null, manufacturer: null, serialNumber: null,
    commissionedOn: '2025-01-01', responsible: 'Иванов И. И.', roomId: null, position: null,
    technicalState: 'исправен' as const, note: null, archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1,
  };

  it('заполненная карточка ничего не требует', () => {
    expect(missingCardFields(base as never)).toEqual([]);
  });

  it('называет всё, чего не хватает', () => {
    const bare = { ...base, regNumber: null, commissionedOn: null, responsible: null };
    expect(missingCardFields(bare as never)).toEqual([
      'учётный номер', 'дата ввода в эксплуатацию', 'ответственный',
    ]);
  });

  it('выведенные из эксплуатации не считаются', () => {
    // Их не обслуживают: запись хранится ради истории, дозаполнять нечего.
    const archived = { ...base, regNumber: null, archivedAt: '2026-02-01T00:00:00.000Z' };
    expect(incompleteCards([archived as never])).toEqual([]);
    expect(incompleteCards([{ ...base, regNumber: null } as never])).toHaveLength(1);
  });
});

describe('склад — не этаж', () => {
  /*
   * Требование заказчика, названное им принципиальным: «элемент на складе ≠
   * элемент, который забыли разместить на плане». До этого программа считала
   * отсутствие координат недоделкой всегда, и резерв попадал в «требуют
   * размещения», в уведомления и в показатели объекта.
   */
  const nodes = [
    { id: 'lvl', kind: 'level' },
    { id: 'sklad', kind: 'storage' },
  ] as never as readonly import('@izh/contracts').TreeNode[];

  const onFloor = { id: 'a', nodeId: 'lvl', position: null, archivedAt: null };
  const placed = { id: 'b', nodeId: 'lvl', position: { x: 1, y: 1 }, archivedAt: null };
  const stored = { id: 'c', nodeId: 'sklad', position: null, archivedAt: null };
  const gone = { id: 'd', nodeId: 'lvl', position: null, archivedAt: '2026-01-01T00:00:00.000Z' };

  it('склады находятся по виду узла, а не по полке и не по координатам', () => {
    expect([...storageNodeIds(nodes)]).toEqual(['sklad']);
  });

  it('размещения требует только элемент на объекте без координат', () => {
    const ids = storageNodeIds(nodes);
    expect(needsPlacement(onFloor as never, ids)).toBe(true);
    expect(needsPlacement(placed as never, ids)).toBe(false);
    expect(needsPlacement(stored as never, ids)).toBe(false);
    // Выведенный из эксплуатации не обслуживают: размещать его незачем.
    expect(needsPlacement(gone as never, ids)).toBe(false);
  });

  it('склад считается отдельно от требующих размещения', () => {
    const ids = storageNodeIds(nodes);
    const all = [onFloor, placed, stored, gone] as never as readonly import('@izh/contracts').PlanObject[];
    expect(countNeedingPlacement(all, ids)).toBe(1);
    expect(countInStorage(all, ids)).toBe(1);
  });
});
