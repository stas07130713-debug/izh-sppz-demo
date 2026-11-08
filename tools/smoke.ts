/**
 * Прогон всех расчётов по журналу предприятия.
 *
 * Отвечает на один вопрос: не падает ли программа и не выдаёт ли пустоту там,
 * где данные есть. Тесты проверяют правила на выдуманных примерах, а здесь по
 * настоящему объекту прогоняются все режимы разом — план, журнал, дашборд,
 * выгрузка, чек-лист, заявка.
 *
 * Запуск: npx vite-node tools/smoke.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaintenanceEvent, PlanObject, TreeNode } from '@izh/contracts';
import { DEFAULT_APP_SETTINGS } from '@izh/contracts';
import {
  activityCellsForObject,
  branchOf,
  checkGroupFor,
  dashboardSummary,
  elementByCode,
  journalScope,
  placementCondition,
  rulePackageSource,
  systemCondition,
  worstObjectStatus,
} from '@izh/core';
import { buildJournalExportRequest } from '../packages/desktop/src/renderer/src/components/journal-export';
import { buildRequestExportRequest } from '../packages/desktop/src/renderer/src/components/request-export';
import { cardColumnsFor } from '../packages/desktop/src/renderer/src/components/journal-columns';

const DATA = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');
const read = <T>(name: string, field: string): readonly T[] => {
  const raw = JSON.parse(readFileSync(join(DATA, `${name}.json`), 'utf8')) as Record<string, unknown>;
  const list = raw[field];
  return Array.isArray(list) ? (list as readonly T[]) : [];
};

const nodes = read<TreeNode>('tree', 'nodes');
const objects = read<PlanObject>('objects', 'objects');
const events = read<MaintenanceEvent>('maintenance', 'events');
const today = new Date().toISOString().slice(0, 10);
const soon = DEFAULT_APP_SETTINGS.soonThresholdDays;
const live = objects.filter((object) => object.archivedAt === null);

const failures: string[] = [];
function step(name: string, run: () => void): void {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  ✗ ${name} — ${message}`);
  }
}

console.log('Прогон по данным предприятия\n');

step('состояние каждого объекта считается', () => {
  for (const object of live) {
    placementCondition(object, live, events, today, soon, rulePackageSource);
    worstObjectStatus(object, events, today, soon, rulePackageSource);
    activityCellsForObject(object, events, today, soon, rulePackageSource);
  }
});

step('состояние систем считается', () => {
  for (const object of live) systemCondition(object, live, events, today, soon, rulePackageSource);
});

step('проверочная группа собирается для каждого объекта', () => {
  for (const object of live) {
    const group = checkGroupFor(nodes, live, object);
    if (group.length === 0) throw new Error(`пустая группа у ${object.id}`);
    if (!group.some((item) => item.id === object.id)) {
      throw new Error(`объект ${object.id} не попал в собственную группу`);
    }
  }
});

step('ветвь дерева собирается для каждого узла', () => {
  for (const node of nodes) {
    if (node.archivedAt !== null) continue;
    const branch = branchOf(nodes, node.id);
    if (branch.length === 0) throw new Error(`пустая ветвь у «${node.name}»`);
  }
});

step('дашборд считается для каждого узла', () => {
  for (const node of nodes) {
    if (node.archivedAt !== null) continue;
    const scope = journalScope(nodes, objects, node.id);
    dashboardSummary({
      objects: scope, events, today, soonThresholdDays: soon,
      source: rulePackageSource, typeCodes: null, levelObjects: scope,
    });
    // И с пустым отбором: снятые галочки не должны ронять расчёт.
    dashboardSummary({
      objects: scope, events, today, soonThresholdDays: soon,
      source: rulePackageSource, typeCodes: new Set(), levelObjects: scope,
    });
  }
});

step('журнал выгружается по каждому узлу во всех форматах', () => {
  for (const node of nodes) {
    if (node.archivedAt !== null) continue;
    const scope = journalScope(nodes, objects, node.id);
    if (scope.length === 0) continue;

    const byType = new Map<string, PlanObject[]>();
    for (const object of scope) {
      byType.set(object.typeCode, [...(byType.get(object.typeCode) ?? []), object]);
    }

    const sections = [...byType.entries()].map(([typeCode, items]) => {
      const columns = cardColumnsFor(typeCode);
      return {
        equipmentTitle: elementByCode(typeCode)?.title ?? typeCode,
        cardTitles: columns.map((column) => column.title),
        rows: items.map((object, index) => ({
          number: index + 1,
          name: object.model ?? elementByCode(object.typeCode)?.title ?? object.typeCode,
          registrationNumber: object.regNumber ?? '',
          place: node.name,
          state: worstObjectStatus(object, events, today, soon, rulePackageSource),
          activities: activityCellsForObject(object, events, today, soon, rulePackageSource).map((cell) => ({
            title: cell.rule.title,
            lastDate: cell.schedule.lastDate ?? '—',
            nextDate: cell.schedule.nextDate ?? '—',
            status: cell.schedule.status,
          })),
          card: columns.map((column) => column.value(object, events)),
          responsible: '',
          note: object.note ?? '',
        })),
      };
    });

    for (const format of ['excel', 'word', 'pdf', 'print'] as const) {
      const request = buildJournalExportRequest(format, {
        title: `Журнал СППЗ — ${node.name}`, scopeTitle: 'Все системы', sections,
      });
      if (request.html.length === 0) throw new Error(`пустая выгрузка по «${node.name}»`);
    }
  }
});

step('заявка собирается по каждому виду оборудования', () => {
  const types = new Set(live.map((object) => object.typeCode));
  for (const typeCode of types) {
    const chosen = live.filter((object) => object.typeCode === typeCode).slice(0, 5);
    const request = buildRequestExportRequest('pdf', {
      template: {
        id: 't', title: 'Проверка', documentTitle: 'Заявка', typeCode,
        columns: [
          { title: '№', source: 'номер' },
          { title: 'Наименование', source: 'наименование' },
          { title: 'Место', source: 'место' },
          { title: 'Неисправность', source: 'неисправность' },
          { title: 'Просрочено', source: 'просрочено' },
          { title: 'Своё', source: 'свой' },
        ],
        footer: ['Подпись'], createdAt: today,
      },
      objects: chosen,
      scopeTitle: elementByCode(typeCode)?.title ?? typeCode,
      context: {
        nodes, events, today,
        settings: DEFAULT_APP_SETTINGS,
        source: rulePackageSource,
      },
    });
    if (request.sheets.length === 0 && chosen.length > 0) {
      throw new Error(`пустая заявка по виду «${typeCode}»`);
    }
  }
});

/*
 * Вид, которого нет в каталоге, — это не поломка программы, а след прежней
 * сборки в данных: она такие элементы показывает, но назвать не может.
 * Поэтому здесь не сбой, а перечень: пользователю решать, удалять их или нет.
 */
const unknown = new Map<string, number>();
for (const object of live) {
  if (elementByCode(object.typeCode) !== null) continue;
  unknown.set(object.typeCode, (unknown.get(object.typeCode) ?? 0) + 1);
}
if (unknown.size > 0) {
  console.log('\nВиды, которых нет в каталоге — остались в данных от прежней сборки:');
  for (const [typeCode, count] of unknown) console.log(`  ${String(count).padStart(4)}  ${typeCode}`);
  console.log('  Такие элементы показываются как «Неизвестный вид»; их можно удалить из дерева.');
}

console.log(`\n${'='.repeat(70)}`);
console.log(failures.length === 0 ? 'Прогон пройден без ошибок.' : `Сбоев: ${failures.length}`);
for (const line of failures) console.log(`  • ${line}`);
