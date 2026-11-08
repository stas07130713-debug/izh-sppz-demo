/**
 * Отбор систем действует одинаково на плане, в журнале и на дашборде.
 *
 * Запуск: npx vite-node tools/three.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dashboardSummary, journalScope, rulePackageSource } from '@izh/core';

const dir = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');
const read = (n: string, f: string) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8'))[f];
const nodes = read('tree', 'nodes');
const objects = read('objects', 'objects');
const events = read('maintenance', 'events');
const today = new Date().toISOString().slice(0, 10);
const soon = 21;

let problems = 0;
for (const node of nodes) {
  if (node.archivedAt !== null) continue;
  const whole = journalScope(nodes, objects, node.id);
  if (whole.length === 0) continue;

  const types = [...new Set(whole.map((o: { typeCode: string }) => o.typeCode))];
  // Прячем каждый вид по очереди и сверяем три экрана.
  for (const hiddenType of types) {
    const hidden = new Set([hiddenType]);

    const onPlan = whole.filter((o) => o.position !== null && !hidden.has(o.typeCode)).length;
    const inJournal = whole.filter((o) => !hidden.has(o.typeCode)).length;
    const shownTypes = new Set(types.filter((t) => !hidden.has(t)));
    const summary = dashboardSummary({
      objects: whole, events, today, soonThresholdDays: soon,
      source: rulePackageSource, typeCodes: shownTypes, levelObjects: whole,
    });

    if (summary.total !== inJournal) {
      console.log(`«${node.name}», скрыт «${hiddenType}»: дашборд ${summary.total}, журнал ${inJournal}`);
      problems += 1;
    }
    const planExpected = whole.filter((o) => o.position !== null && !hidden.has(o.typeCode)).length;
    if (onPlan !== planExpected) {
      console.log(`«${node.name}», скрыт «${hiddenType}»: план ${onPlan}, ожидалось ${planExpected}`);
      problems += 1;
    }
  }
}
console.log(problems === 0 ? 'Три экрана считают одинаково.' : `Расхождений: ${problems}`);
