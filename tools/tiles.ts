import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { journalScope, objectCondition, rulePackageSource, technicalStateForObject, dashboardSummary } from '@izh/core';
import { conditionFilterTags } from '../packages/desktop/src/renderer/src/components/status-filter';

const dir = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');
const read = (n: string, f: string) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8'))[f];
const nodes = read('tree', 'nodes');
const objects = read('objects', 'objects');
const events = read('maintenance', 'events');
const today = new Date().toISOString().slice(0, 10);
const soon = 21;

for (const node of nodes) {
  if (node.archivedAt !== null) continue;
  const scope = journalScope(nodes, objects, node.id);
  if (scope.length === 0) continue;

  const summary = dashboardSummary({
    objects: scope, events, today, soonThresholdDays: soon,
    source: rulePackageSource, typeCodes: null, levelObjects: scope,
  });

  const byTag = new Map<string, number>();
  for (const object of scope) {
    for (const tag of conditionFilterTags(objectCondition(object, events, today, soon, rulePackageSource))) {
      byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    }
  }

  const pairs: readonly (readonly [string, number, number])[] = [
    ['норма', summary.tagCounts['норма'], byTag.get('норма') ?? 0],
    ['скоро', summary.tagCounts['скоро'], byTag.get('скоро') ?? 0],
    ['просрочено', summary.tagCounts['просрочено'], byTag.get('просрочено') ?? 0],
    ['неисправно', summary.tagCounts['неисправно'], byTag.get('неисправно') ?? 0],
    ['нет данных', summary.tagCounts['нет данных'], byTag.get('нет данных') ?? 0],
  ];

  const bad = pairs.filter(([, tile, journal]) => tile !== journal);
  if (bad.length > 0) {
    console.log(`«${node.name}» (${scope.length} элементов):`);
    for (const [tag, tile, journal] of bad) {
      console.log(`  ${tag}: плитка ${tile}, а журнал покажет ${journal}`);
    }
  }
}
console.log('— проверено —');
