/**
 * Проверка программы на настоящих данных.
 *
 * Не подмена тестов: тесты проверяют правила по частям и на выдуманных
 * примерах, а здесь по журналу предприятия проверяются согласования между
 * частями — то, что показывает план, карточка, журнал и дашборд, обязано
 * сходиться. Расхождение между ними пользователь видит сразу, а тестам оно
 * незаметно, потому что каждая часть по отдельности права.
 *
 * Запуск: npx vite-node tools/audit.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaintenanceEvent, PlanObject, TreeNode } from '@izh/contracts';
import { DEFAULT_APP_SETTINGS } from '@izh/contracts';
import {
  activityCellsForObject,
  dashboardSummary,
  elementByCode,
  journalScope,
  objectCondition,
  placementCondition,
  rulePackageSource,
  systemCondition,
  technicalStateForObject,
  worstObjectStatus,
} from '@izh/core';

const DATA = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');
/** Файлы хранилища лежат объектом с одним полем-списком внутри. */
function read<T>(name: string, field: string): readonly T[] {
  const raw = JSON.parse(readFileSync(join(DATA, `${name}.json`), 'utf8')) as Record<string, unknown>;
  const list = raw[field];
  return Array.isArray(list) ? (list as readonly T[]) : [];
}

const nodes = read<TreeNode>('tree', 'nodes');
const objects = read<PlanObject>('objects', 'objects');
const events = read<MaintenanceEvent>('maintenance', 'events');
const settings = {
  ...DEFAULT_APP_SETTINGS,
  ...(JSON.parse(readFileSync(join(DATA, 'settings.json'), 'utf8')) as Record<string, unknown>),
};

const today = new Date().toISOString().slice(0, 10);
const soon = settings.soonThresholdDays;
const live = objects.filter((object) => object.archivedAt === null);

const problems: string[] = [];
const note = (line: string): void => { problems.push(line); };

const nameOf = (object: PlanObject): string =>
  `${elementByCode(object.typeCode)?.title ?? object.typeCode} № ${object.regNumber ?? object.id}`;

console.log(`Данные: узлов ${nodes.length}, объектов ${live.length} (архивных ${objects.length - live.length}), записей ${events.length}`);
console.log(`Сегодня ${today}, порог «скоро» ${soon} дней\n`);

/* 1. Просроченная работа обязана красить элемент. */
let overdueObjects = 0;
for (const object of live) {
  const cells = activityCellsForObject(object, events, today, soon, rulePackageSource);
  const worstCell = cells.some((cell) => cell.schedule.status === 'просрочено');
  const status = worstObjectStatus(object, events, today, soon, rulePackageSource);
  if (worstCell) overdueObjects += 1;
  if (worstCell && status !== 'просрочено') {
    note(`СОСТОЯНИЕ: у «${nameOf(object)}» просрочена работа, а элемент считается «${status}»`);
  }
  if (!worstCell && status === 'просрочено') {
    note(`СОСТОЯНИЕ: «${nameOf(object)}» считается просроченным, но просроченных работ нет`);
  }
}

/* 2. Цвет карточки и цвет значка на плане — одно и то же. */
for (const object of live) {
  const card = placementCondition(object, live, events, today, soon, rulePackageSource);
  const own = objectCondition(object, events, today, soon, rulePackageSource);
  if (card.schedule !== own.schedule && card.color === own.color) continue;
  if (card.color !== own.color) {
    // Это законно только у комплектов: место красится по худшей единице.
    const isPlacement = live.some((item) => item.placementId === object.id);
    if (!isPlacement) {
      note(`ЦВЕТ: «${nameOf(object)}» — значок ${card.color}, а сам объект ${own.color}, хотя это не комплект`);
    }
  }
}

/* 3. Числа дашборда складываются и совпадают с журналом. */
for (const node of nodes.filter((item) => item.archivedAt === null)) {
  const scope = journalScope(nodes, objects, node.id);
  if (scope.length === 0) continue;

  const summary = dashboardSummary({
    objects: scope, events, today, soonThresholdDays: soon,
    source: rulePackageSource, typeCodes: null, levelObjects: scope,
  });

  const sum = Object.values(summary.counts).reduce((total, value) => total + value, 0);
  if (sum !== scope.length) {
    note(`ДАШБОРД: в «${node.name}» состояния дают ${sum}, а элементов ${scope.length}`);
  }
  if (summary.total !== scope.length) {
    note(`ДАШБОРД: в «${node.name}» всего ${summary.total}, а в области журнала ${scope.length}`);
  }

  const overdueInScope = scope.filter((object) =>
    worstObjectStatus(object, events, today, soon, rulePackageSource) === 'просрочено').length;
  if (summary.counts['просрочено'] !== overdueInScope) {
    note(`ДАШБОРД: в «${node.name}» просроченных ${summary.counts['просрочено']}, а по журналу ${overdueInScope}`);
  }
}

/* 4. Записи журнала ссылаются на существующие объекты и работы. */
const byId = new Map(objects.map((object) => [object.id, object]));
for (const event of events) {
  const object = byId.get(event.objectId);
  if (object === undefined) {
    note(`ЖУРНАЛ: запись ${event.id} от ${event.performedOn} ссылается на несуществующий объект ${event.objectId}`);
    continue;
  }
  const codes = new Set(rulePackageSource.rulesFor(object, event.performedOn).map((rule) => rule.activityCode));
  const known = codes.has(event.activityCode)
    || rulePackageSource.rulesFor(object, event.performedOn)
      .some((rule) => rule.historyCodes?.includes(event.activityCode) === true);
  if (!known) {
    note(`ЖУРНАЛ: у «${nameOf(object)}» запись о работе «${event.activityCode}», которой нет в регламенте`);
  }
}

/* 5. Состав систем: элемент ссылается на существующий прибор. */
for (const object of live) {
  const systemId = (object as { systemId?: string | null }).systemId ?? null;
  if (systemId === null) continue;
  const head = byId.get(systemId);
  if (head === undefined) {
    note(`СИСТЕМА: «${nameOf(object)}» подключён к несуществующему прибору ${systemId}`);
  } else if (head.archivedAt !== null) {
    note(`СИСТЕМА: «${nameOf(object)}» подключён к удалённому прибору «${nameOf(head)}»`);
  }
}

/* 6. У прибора состояние системы не лучше своего. */
for (const object of live) {
  const condition = systemCondition(object, live, events, today, soon, rulePackageSource);
  if (condition === null) continue;
  const rank = (color: string): number => (color === 'danger' ? 0 : color === 'warn' ? 1 : color === 'unknown' ? 2 : 3);
  if (rank(condition.whole.color) > rank(condition.own.color)) {
    note(`СИСТЕМА: у «${nameOf(object)}» система (${condition.whole.color}) спокойнее самого прибора (${condition.own.color})`);
  }
}

/* 7. Объекты стоят в существующих узлах. */
const nodeIds = new Set(nodes.map((node) => node.id));
for (const object of live) {
  if (!nodeIds.has(object.nodeId)) {
    note(`ДЕРЕВО: «${nameOf(object)}» стоит в несуществующем узле ${object.nodeId}`);
  }
}

/* 7б. Просроченный элемент не может выглядеть спокойным. */
for (const object of live) {
  const condition = placementCondition(object, live, events, today, soon, rulePackageSource);
  if (condition.schedule === 'просрочено' && condition.color !== 'danger') {
    note(`СОСТОЯНИЕ: «${nameOf(object)}» просрочен, а цвет ${condition.color}`);
  }
  if (condition.schedule === 'норма' && condition.color === 'danger' && condition.technical === 'исправен') {
    note(`СОСТОЯНИЕ: «${nameOf(object)}» в норме и исправен, а цвет тревожный`);
  }
}

/* 8. Каждый вид оборудования, который встречается в данных, знает свои работы. */
const typesInUse = new Map<string, number>();
for (const object of live) typesInUse.set(object.typeCode, (typesInUse.get(object.typeCode) ?? 0) + 1);
for (const [typeCode, count] of typesInUse) {
  if (elementByCode(typeCode) === null) {
    note(`КАТАЛОГ: вид «${typeCode}» встречается ${count} раз, но его нет в каталоге элементов`);
    continue;
  }
  const sample = live.find((object) => object.typeCode === typeCode);
  if (sample === undefined) continue;
  if (rulePackageSource.rulesFor(sample, today).length === 0) {
    note(`РЕГЛАМЕНТ: у вида «${elementByCode(typeCode)?.title ?? typeCode}» (${count} шт.) нет ни одной работы — журнал по нему пуст`);
  }
}

/* 9. Учётные номера не повторяются в пределах узла. */
const numbers = new Map<string, string[]>();
for (const object of live) {
  if (object.regNumber === null) continue;
  const key = `${object.nodeId}|${object.typeCode}|${object.regNumber}`;
  numbers.set(key, [...(numbers.get(key) ?? []), object.id]);
}
for (const [key, ids] of numbers) {
  if (ids.length > 1) {
    const parts = key.split('|');
    note(`НОМЕРА: «${elementByCode(parts[1] ?? '')?.title ?? parts[1]}» № ${parts[2]} заведён ${ids.length} раза в одном узле`);
  }
}

/* 10. Даты не из будущего и не из позапрошлого века. */
for (const event of events) {
  if (event.performedOn > today) {
    note(`ДАТЫ: проверка ${event.id} записана будущим числом ${event.performedOn}`);
  }
  if (event.performedOn < '2000-01-01') {
    note(`ДАТЫ: проверка ${event.id} записана числом ${event.performedOn}`);
  }
}
for (const object of live) {
  if (object.commissionedOn !== null && object.commissionedOn > today) {
    note(`ДАТЫ: «${nameOf(object)}» введён в эксплуатацию будущим числом ${object.commissionedOn}`);
  }
}

/* 11. Комплекты: единица ссылается на существующее место хранения. */
for (const object of live) {
  const placementId = (object as { placementId?: string | null }).placementId ?? null;
  if (placementId === null) continue;
  const host = byId.get(placementId);
  if (host === undefined) {
    note(`КОМПЛЕКТ: «${nameOf(object)}» лежит в несуществующем месте ${placementId}`);
  } else if (host.typeCode !== object.typeCode) {
    note(`КОМПЛЕКТ: «${nameOf(object)}» лежит в месте другого вида — «${nameOf(host)}»`);
  }
}

/* 12. Дерево: у каждого узла есть родитель, и петель нет. */
const nodeById = new Map(nodes.map((node) => [node.id, node]));
for (const node of nodes) {
  if (node.parentId === null) continue;
  const parent = nodeById.get(node.parentId);
  if (parent === undefined) {
    note(`ДЕРЕВО: у узла «${node.name}» родитель ${node.parentId} не найден`);
    continue;
  }
  const path = new Set<string>();
  let current: typeof node | undefined = node;
  while (current !== undefined && current.parentId !== null) {
    if (path.has(current.id)) {
      note(`ДЕРЕВО: узел «${node.name}» замкнут в петлю`);
      break;
    }
    path.add(current.id);
    current = nodeById.get(current.parentId);
  }
}

/* 8. Сводка по состояниям — чтобы было видно, на что смотреть глазами. */
const spread = new Map<string, number>();
for (const object of live) {
  const status = worstObjectStatus(object, events, today, soon, rulePackageSource);
  const state = technicalStateForObject(object, events);
  const key = `${status} / ${state}`;
  spread.set(key, (spread.get(key) ?? 0) + 1);
}

console.log('Состояние по журналу (срок / исправность):');
for (const [key, count] of [...spread.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(4)}  ${key}`);
}
console.log(`\nЭлементов с просроченными работами: ${overdueObjects}`);

console.log(`\n${'='.repeat(70)}`);
if (problems.length === 0) {
  console.log('Расхождений не найдено.');
} else {
  console.log(`Найдено расхождений: ${problems.length}`);
  const shown = problems.slice(0, 40);
  for (const line of shown) console.log(`  • ${line}`);
  if (problems.length > shown.length) console.log(`  … и ещё ${problems.length - shown.length}`);
}
