/**
 * Карточка прибора приёмно-контрольного (ТЗ, Дополнение 6).
 *
 * Прибор — голова системы пожарной автоматики, и его карточка отвечает за всю
 * систему: состав, резервное питание, рабочая документация, единый чек-лист.
 * Проверяется не оформление полей, а то, что сведения доходят до хранилища и
 * что проверка прибора закрывает систему целиком, а не одну железку.
 */

import { describe, expect, it } from 'vitest';
import type { ControlPanelProfile, PlanObject } from '@izh/contracts';
import type { ObjectDeps } from '../objects/object-deps.js';
import { placeObject, updateObject } from '../objects/object-scenarios.js';
import { setSystemComposition } from '../objects/system-composition-scenarios.js';
import { checkGroupFor, checkGroupTitle } from '../objects/check-group.js';
import {
  AUTOMATION_MANUFACTURERS, automationModels, isKnownAutomationManufacturer,
} from '../objects/automation-reference.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';

const PROFILE: ControlPanelProfile = {
  execution: 'ППКУ',
  backupPower: { source: 'аккумуляторная батарея', batteryKind: 'свинцово-кислотный (AGM)', capacityAh: 7, count: 2 },
  projectDocuments: [{ hash: 'a'.repeat(64), fileName: 'Проект СПЗ.pdf' }],
};

async function makeFixture() {
  const treeDeps = makeTreeDeps();
  const tree = await makeSampleTree(treeDeps);
  const objects = fakePlanObjectRepository();
  const deps: ObjectDeps = { objects, tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() };
  const nodes = value(await treeDeps.tree.list());

  const panel = value<PlanObject>(
    await placeObject(deps, { nodeId: tree.level.id, typeCode: 'control-panel', position: { x: 2, y: 2 } }),
  );
  return { deps, nodes, panel, floorId: tree.level.id };
}

describe('сведения карточки прибора', () => {
  it('исполнение, резервное питание и документы сохраняются', async () => {
    const { deps, panel } = await makeFixture();

    const saved = value<PlanObject>(await updateObject(deps, { id: panel.id, controlPanelProfile: PROFILE }));

    expect(saved.controlPanelProfile?.execution).toBe('ППКУ');
    expect(saved.controlPanelProfile?.backupPower?.capacityAh).toBe(7);
    expect(saved.controlPanelProfile?.backupPower?.count).toBe(2);
    expect(saved.controlPanelProfile?.projectDocuments).toHaveLength(1);
  });

  it('правка другого поля карточку прибора не стирает', async () => {
    // На этом уже спотыкались с пожарным краном: непереданное поле молча
    // превращалось в пустое, и сведения о системе исчезали при первой же
    // правке примечания.
    const { deps, panel } = await makeFixture();
    await updateObject(deps, { id: panel.id, controlPanelProfile: PROFILE });

    const saved = value<PlanObject>(await updateObject(deps, { id: panel.id, note: 'щитовая' }));

    expect(saved.controlPanelProfile?.execution).toBe('ППКУ');
    expect(saved.controlPanelProfile?.projectDocuments).toHaveLength(1);
  });
});

describe('чек-лист прибора единый на всю систему', () => {
  it('проверка прибора закрывает элементы всех видов его системы', async () => {
    const { deps, nodes, panel, floorId } = await makeFixture();
    await setSystemComposition(deps, {
      headId: panel.id,
      nodes,
      items: [
        { typeCode: 'smoke-detector', nodeId: floorId, count: 3 },
        { typeCode: 'sounder', nodeId: floorId, count: 2 },
      ],
    });
    const all = value<readonly PlanObject[]>(await deps.objects.list());

    const group = checkGroupFor(nodes, all, panel);

    // Прибор плюс пять элементов: виды не разделяются, систему обслуживают
    // одним заходом.
    expect(group).toHaveLength(6);
    expect(group.some((object) => object.id === panel.id)).toBe(true);
    expect(new Set(group.map((object) => object.typeCode))).toEqual(
      new Set(['control-panel', 'smoke-detector', 'sounder']),
    );
  });

  it('элемент системы закрывает только однотипных соседей, а не всю систему', async () => {
    // Обратная сторона правила: с извещателя нельзя закрыть оповещатели —
    // у них другой регламент и другие сроки.
    const { deps, nodes, panel, floorId } = await makeFixture();
    await setSystemComposition(deps, {
      headId: panel.id,
      nodes,
      items: [
        { typeCode: 'smoke-detector', nodeId: floorId, count: 3 },
        { typeCode: 'sounder', nodeId: floorId, count: 2 },
      ],
    });
    const all = value<readonly PlanObject[]>(await deps.objects.list());
    const detector = all.find((object) => object.typeCode === 'smoke-detector');

    const group = checkGroupFor(nodes, all, detector as PlanObject);

    expect(group).toHaveLength(3);
    expect(group.every((object) => object.typeCode === 'smoke-detector')).toBe(true);
  });

  it('заголовок группы называет систему целиком', async () => {
    const { panel } = await makeFixture();
    expect(checkGroupTitle(panel, 'Прибор приёмно-контрольный')).toContain('вся система целиком');
  });
});

describe('справочник оборудования автоматики', () => {
  it('у каждого изготовителя есть хотя бы один прибор', () => {
    // Изготовитель попадает в справочник ради прибора: с него начинается
    // система, и от него подставляются марки остального оборудования.
    for (const item of AUTOMATION_MANUFACTURERS) {
      expect(automationModels(item.name, 'control-panel').length, item.name).toBeGreaterThan(0);
    }
  });

  it('модель не повторяется у двух изготовителей', () => {
    // Иначе выбор модели перестаёт однозначно определять изготовителя.
    const seen = new Set<string>();
    for (const item of AUTOMATION_MANUFACTURERS) {
      for (const models of Object.values(item.models)) {
        for (const model of models) {
          expect(seen.has(model), model).toBe(false);
          seen.add(model);
        }
      }
    }
  });

  it('модели находятся по изготовителю и виду оборудования', () => {
    expect(automationModels('НВП «Болид»', 'control-panel')).toContain('С2000М');
    expect(automationModels('НВП «Болид»', 'smoke-detector')).toContain('ДИП-34А-03');
    expect(automationModels('ГК «Рубеж»', 'smoke-detector')).toContain('ИП 212-64 прот. R3');
    // Вид без сверенного списка даёт пустой — марка вводится текстом, а не
    // берётся от чужого изготовителя.
    expect(automationModels('ООО «Юнитест»', 'smoke-detector')).toEqual([]);
    expect(automationModels('ООО «Ромашка»', 'control-panel')).toEqual([]);
  });

  it('извещатель не берёт марку у чужого изготовителя', () => {
    // Адресный протокол у каждого свой: болидовский извещатель с прибором
    // «Рубежа» не заработает, и подсказывать такую пару нельзя.
    for (const item of AUTOMATION_MANUFACTURERS) {
      for (const model of automationModels(item.name, 'smoke-detector')) {
        const others = AUTOMATION_MANUFACTURERS.filter((other) => other.name !== item.name);
        expect(others.some((other) => automationModels(other.name, 'smoke-detector').includes(model))).toBe(false);
      }
    }
  });

  it('известность изготовителя определяется справочником', () => {
    expect(isKnownAutomationManufacturer('ГК «Рубеж»')).toBe(true);
    expect(isKnownAutomationManufacturer('ООО «Ромашка»')).toBe(false);
    expect(isKnownAutomationManufacturer(null)).toBe(false);
  });
});
