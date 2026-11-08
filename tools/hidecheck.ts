import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { journalScope } from '@izh/core';
import { GROUP_ORDER, byCatalogOrder, systemGroupOf } from '../packages/desktop/src/renderer/src/components/journal-groups';

const dir = join(process.env.APPDATA ?? '', '@izh', 'desktop', 'data');
const read = (n: string, f: string) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8'))[f];
const nodes = read('tree', 'nodes');
const objects = read('objects', 'objects');

const node = nodes.find((n: { kind: string; archivedAt: string | null }) => n.kind === 'level' && n.archivedAt === null);
if (node === undefined) throw new Error('нет этажа');

const scope = journalScope(nodes, objects, node.id).filter((o) => o.archivedAt === null);
console.log(`Узел «${node.name}»: ${scope.length} элементов`);

// Ровно та же выборка, что делает панель.
for (const group of GROUP_ORDER) {
  const items = scope.filter((item) => systemGroupOf(item.typeCode) === group);
  if (items.length === 0) continue;
  const codes = [...new Set(items.map((i) => i.typeCode))].sort(byCatalogOrder);

  // Снимаем галочку раздела.
  let hidden = new Set<string>();
  const allVisible = codes.every((code) => !hidden.has(code));
  if (allVisible) for (const code of codes) hidden.add(code);

  const placed = scope.filter((o) => o.position !== null && !hidden.has(o.typeCode));
  console.log(`  ${group}: видов ${codes.length}, скрыто ${hidden.size}, на плане останется ${placed.length} из ${scope.filter((o) => o.position !== null).length}`);
}
