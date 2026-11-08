/**
 * Локальные нормативные документы (Дополнение 5, часть Р6).
 *
 * Документ — основание, на которое ссылается своё мероприятие организации.
 * Здесь закреплено главное: документ правится, но не исчезает, а вывод его из
 * действия — это дата окончания, а не удаление. Записи журнала ссылаются на
 * мероприятия, а те на документ; исчезнувший документ оставил бы прошлую
 * проверку без основания.
 */

import { describe, expect, it } from 'vitest';
import type { LocalDocument, Regulation, RegulationRepository, RegulationTemplate, RegulationVersion } from '@izh/contracts';
import { ok } from '@izh/contracts';
import type { RegulationDeps } from '../regulations/regulation-deps.js';
import { documentActiveOn, saveLocalDocument } from '../regulations/local-document-scenarios.js';
import { fakeClock, fakeIdGenerator } from './test-doubles.js';

function fakeRepository(): RegulationRepository {
  const regulations = new Map<string, Regulation>();
  const versions = new Map<string, RegulationVersion>();
  const documents = new Map<string, LocalDocument>();
  const templates = new Map<string, RegulationTemplate>();

  return {
    async listRegulations() { return ok([...regulations.values()]); },
    async listVersions() { return ok([...versions.values()]); },
    async listDocuments() { return ok([...documents.values()]); },
    async listTemplates() { return ok([...templates.values()]); },
    async saveRegulation(regulation) { regulations.set(regulation.id, regulation); return ok(undefined); },
    async saveVersions(incoming) { for (const v of incoming) versions.set(v.id, v); return ok(undefined); },
    async saveDocument(document) { documents.set(document.id, document); return ok(undefined); },
    async saveTemplate(template) { templates.set(template.id, template); return ok(undefined); },
  };
}

function makeDeps(): RegulationDeps {
  return { regulations: fakeRepository(), clock: fakeClock(), ids: fakeIdGenerator() };
}

const BASE = {
  title: 'Инструкция о мерах пожарной безопасности',
  number: '15-ПБ',
  approvedOn: '2026-01-10',
  effectiveFrom: '2026-01-15',
  effectiveTo: null,
  organization: 'ООО «Пример»',
  department: null,
  fileHash: null,
  note: null,
} as const;

function value<T>(result: { ok: boolean } & Record<string, unknown>): T {
  if (!result.ok) throw new Error(`Ожидался успех: ${JSON.stringify(result)}`);
  return result.value as T;
}

describe('локальные нормативные документы', () => {
  it('заводит документ с реквизитами', async () => {
    const deps = makeDeps();

    const document = value<LocalDocument>(await saveLocalDocument(deps, BASE));

    expect(document.title).toBe('Инструкция о мерах пожарной безопасности');
    expect(document.number).toBe('15-ПБ');
    expect(document.effectiveTo).toBeNull();
  });

  it('правит существующий документ, а не заводит второй', async () => {
    // Опечатку в номере приказа исправляют, а не выпускают приказ заново:
    // документ — это карточка действующего акта, а не событие журнала.
    const deps = makeDeps();
    const first = value<LocalDocument>(await saveLocalDocument(deps, BASE));

    await saveLocalDocument(deps, { ...BASE, id: first.id, number: '15/1-ПБ' });

    const all = value<readonly LocalDocument[]>(await deps.regulations.listDocuments());
    expect(all).toHaveLength(1);
    expect(all[0]?.number).toBe('15/1-ПБ');
  });

  it('требует название', async () => {
    const deps = makeDeps();

    expect((await saveLocalDocument(deps, { ...BASE, title: '   ' })).ok).toBe(false);
  });

  it('не принимает окончание действия раньше начала', async () => {
    const deps = makeDeps();

    const result = await saveLocalDocument(deps, {
      ...BASE,
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-01-01',
    });

    expect(result.ok).toBe(false);
  });

  it('не принимает дату не в календарном формате', async () => {
    const deps = makeDeps();

    expect((await saveLocalDocument(deps, { ...BASE, approvedOn: '10.01.2026' })).ok).toBe(false);
  });

  it('пустые реквизиты сохраняются как «не задано», а не пустой строкой', async () => {
    const deps = makeDeps();

    const document = value<LocalDocument>(
      await saveLocalDocument(deps, { ...BASE, number: '   ', department: '' }),
    );

    expect(document.number).toBeNull();
    expect(document.department).toBeNull();
  });
});

describe('действие документа на дату', () => {
  const document: LocalDocument = {
    id: 'doc-1', title: 'Приказ', number: null, approvedOn: null,
    effectiveFrom: '2026-02-01', effectiveTo: '2026-08-31',
    organization: null, department: null, fileHash: null, note: null,
  };

  it('до начала действия — не действует', () => {
    expect(documentActiveOn(document, '2026-01-31')).toBe(false);
  });

  it('в первый и последний день — действует', () => {
    expect(documentActiveOn(document, '2026-02-01')).toBe(true);
    expect(documentActiveOn(document, '2026-08-31')).toBe(true);
  });

  it('после окончания — не действует, но сам документ остаётся', () => {
    expect(documentActiveOn(document, '2026-09-01')).toBe(false);
  });

  it('документ без сроков действует всегда', () => {
    const undated: LocalDocument = { ...document, effectiveFrom: null, effectiveTo: null };

    expect(documentActiveOn(undated, '2020-01-01')).toBe(true);
    expect(documentActiveOn(undated, '2030-01-01')).toBe(true);
  });
});
