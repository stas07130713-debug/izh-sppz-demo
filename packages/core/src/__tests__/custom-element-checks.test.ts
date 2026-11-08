/**
 * Проверки своего вида элемента (движок E4 поверх E3, ТЗ часть С100).
 *
 * Главное здесь — где они хранятся. Задаются они в конструкторе видов, а лежат
 * регламентом, как у встроенного оборудования. Ошибка в этом месте не видна:
 * проверки сохранятся, покажутся в настройках и не попадут ни в сроки, ни в
 * журнал, потому что движок регламентов о них не узнает.
 */

import { describe, expect, it } from 'vitest';
import type {
  Clock, IdGenerator, LocalDocument, Regulation, RegulationRepository,
  RegulationTemplate, RegulationVersion, Result,
} from '@izh/contracts';
import { ok } from '@izh/contracts';
import {
  customElementRegulation, latestVersion, periodicityFromInput, saveCustomElementChecks,
} from '../objects/custom-element-checks.js';

const TODAY = '2026-09-01';
const CODE = 'custom-0001';

/** Хранилище в памяти: проверяется сценарий, а не диск. */
function repository(): { readonly port: RegulationRepository; readonly state: {
  regulations: Regulation[]; versions: RegulationVersion[];
} } {
  const state = { regulations: [] as Regulation[], versions: [] as RegulationVersion[] };
  const port: RegulationRepository = {
    listRegulations: async (): Promise<Result<readonly Regulation[]>> => ok(state.regulations),
    listVersions: async (): Promise<Result<readonly RegulationVersion[]>> => ok(state.versions),
    listDocuments: async (): Promise<Result<readonly LocalDocument[]>> => ok([]),
    listTemplates: async (): Promise<Result<readonly RegulationTemplate[]>> => ok([]),
    saveRegulation: async (regulation: Regulation): Promise<Result<void>> => {
      const at = state.regulations.findIndex((item) => item.id === regulation.id);
      if (at < 0) state.regulations.push(regulation); else state.regulations[at] = regulation;
      return ok(undefined);
    },
    saveVersions: async (versions: readonly RegulationVersion[]): Promise<Result<void>> => {
      for (const version of versions) {
        const at = state.versions.findIndex((item) => item.id === version.id);
        if (at < 0) state.versions.push(version); else state.versions[at] = version;
      }
      return ok(undefined);
    },
    saveDocument: async (): Promise<Result<void>> => ok(undefined),
    saveTemplate: async (): Promise<Result<void>> => ok(undefined),
  } as unknown as RegulationRepository;
  return { port, state };
}

let counter = 0;
const ids: IdGenerator = { newId: () => `id${(counter += 1)}` };
const clock: Clock = { nowUtc: () => '2026-09-01T10:00:00.000Z' };

const MONTHLY = periodicityFromInput({
  id: 'p1', title: 'Ежемесячный осмотр', every: 1, unit: 'месяц',
  works: [{ id: 'w1', title: 'Осмотреть, нет ли повреждений' }],
});

describe('сборка периодичности', () => {
  it('работы становятся строками чек-листа с ответом «галочка»', () => {
    expect(MONTHLY.activities).toHaveLength(1);
    expect(MONTHLY.activities[0]?.answerKind).toBe('галочка');
    expect(MONTHLY.activities[0]?.title).toBe('Осмотреть, нет ли повреждений');
    expect(MONTHLY.enabled).toBe(true);
  });

  it('пустые строки работ отбрасываются: пустая строка чек-листа ничего не значит', () => {
    const built = periodicityFromInput({
      id: 'p2', title: 'Осмотр', every: 1, unit: 'месяц',
      works: [{ id: 'w1', title: 'Осмотреть' }, { id: 'w2', title: '   ' }],
    });
    expect(built.activities).toHaveLength(1);
  });

  it('срок меньше единицы не проходит: «раз в ноль месяцев» — не срок', () => {
    const built = periodicityFromInput({ id: 'p3', title: 'Осмотр', every: 0, unit: 'месяц', works: [] });
    expect(built.rule).toEqual({ kind: 'интервал', every: 1, unit: 'месяц' });
  });
});

describe('где хранятся проверки', () => {
  it('первое сохранение заводит регламент вида с областью «тип оборудования»', async () => {
    const { port, state } = repository();

    const saved = await saveCustomElementChecks({ regulations: port, clock, ids }, {
      typeCode: CODE, title: 'Ящик с песком', periodicities: [MONTHLY], today: TODAY, regulations: [],
    });

    expect(saved.ok).toBe(true);
    expect(state.regulations).toHaveLength(1);
    expect(state.regulations[0]?.scope).toBe('тип оборудования');
    expect(state.regulations[0]?.targetId).toBe(CODE);
    expect(state.regulations[0]?.typeCode).toBe(CODE);
    expect(state.versions[0]?.periodicities).toHaveLength(1);
  });

  it('повторное сохранение выпускает новую версию, а не переписывает прежнюю', async () => {
    const { port, state } = repository();

    const first = await saveCustomElementChecks({ regulations: port, clock, ids }, {
      typeCode: CODE, title: 'Ящик с песком', periodicities: [MONTHLY], today: TODAY, regulations: [],
    });
    expect(first.ok).toBe(true);

    const second = await saveCustomElementChecks({ regulations: port, clock, ids }, {
      typeCode: CODE,
      title: 'Ящик с песком',
      periodicities: [MONTHLY, periodicityFromInput({
        id: 'p9', title: 'Годовая проверка', every: 1, unit: 'год',
        works: [{ id: 'w9', title: 'Заменить песок' }],
      })],
      today: '2026-10-01',
      regulations: state.regulations,
    });
    expect(second.ok).toBe(true);

    // Регламент один, версий две: прошлые проверки сохраняют свой состав работ.
    expect(state.regulations).toHaveLength(1);
    expect(state.versions.length).toBeGreaterThanOrEqual(2);
    const latest = latestVersion(state.versions, state.regulations[0]?.id ?? '');
    expect(latest?.periodicities).toHaveLength(2);
  });

  it('регламент вида находится по области и цели, а не по названию', async () => {
    const { port, state } = repository();
    await saveCustomElementChecks({ regulations: port, clock, ids }, {
      typeCode: CODE, title: 'Ящик с песком', periodicities: [MONTHLY], today: TODAY, regulations: [],
    });

    // Название правят — связь держаться на нём не должна.
    state.regulations[0] = { ...(state.regulations[0] as Regulation), title: 'Совсем другое название' };

    expect(customElementRegulation(state.regulations, CODE)?.targetId).toBe(CODE);
    expect(customElementRegulation(state.regulations, 'custom-другой')).toBeNull();
  });
});
