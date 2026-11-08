/**
 * Какой узел внутрь какого разрешено вкладывать и какая у него рабочая область.
 *
 * Правила заданы таблицей, а не цепочкой условий в коде: в дальнейшем эта
 * таблица переедет в настройки, потому что пользователь заводит свои виды узлов
 * без программиста (решение Р9 «конструктор типов»). Пока таблица неизменяема,
 * но обращаются к ней уже как к данным — и ядро, и интерфейс.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, части 3 и 5.
 */

import type { NodeKind } from '@izh/contracts';

/** Что показывается в центре при выборе узла. */
export type PlanKind =
  /** Рабочей области нет: узел только группирует другие. */
  | 'none'
  /** Генплан объекта: гидранты, наружные лестницы, места подключения пожарной техники. */
  | 'general'
  /** Поэтажный план: системы противопожарной защиты этажа. */
  | 'floor'
  /** Окно склада: состав важен, координаты — нет. */
  | 'storage';

export interface NodeKindRule {
  readonly kind: NodeKind;
  /** Название вида в единственном числе, для кнопок и заголовков. */
  readonly title: string;
  /** Внутрь каких узлов можно положить. Пустой список — только корень дерева. */
  readonly allowedParents: readonly NodeKind[];
  readonly planKind: PlanKind;
  /** Запрашивать ли отметку в метрах. Только у этажа. */
  readonly hasElevation: boolean;
  /** Заполняются ли характеристики в части пожарной безопасности. Только у здания. */
  readonly hasBuildingProfile: boolean;
  /** Пояснение для пользователя: что это за узел и зачем он. */
  readonly hint: string;
}

export const NODE_KIND_RULES: readonly NodeKindRule[] = [
  {
    kind: 'organization',
    title: 'Организация',
    allowedParents: [],
    planKind: 'none',
    hasElevation: false,
    hasBuildingProfile: false,
    hint: 'Предприятие или организация. Корень дерева.',
  },
  {
    kind: 'shop',
    title: 'Цех',
    allowedParents: ['organization'],
    planKind: 'none',
    hasElevation: false,
    hasBuildingProfile: false,
    hint: 'Группировка зданий. Необязателен: здание можно завести прямо в организации.',
  },
  {
    kind: 'building',
    title: 'Здание',
    allowedParents: ['organization', 'shop'],
    planKind: 'general',
    hasElevation: false,
    hasBuildingProfile: true,
    hint: 'Здание или сооружение. Его рабочая область — генплан объекта: гидранты, наружные лестницы, места подключения пожарной техники.',
  },
  {
    kind: 'level',
    title: 'Этаж (отметка)',
    allowedParents: ['building'],
    planKind: 'floor',
    hasElevation: true,
    hasBuildingProfile: false,
    hint: 'Этаж или отметка со своим поэтажным планом и журналом систем защиты этажа.',
  },
  {
    kind: 'storage',
    title: 'Склад',
    allowedParents: ['building'],
    planKind: 'storage',
    hasElevation: false,
    hasBuildingProfile: false,
    hint: 'Запасное оборудование, снятое на перезарядку, а также числящееся за пожарной техникой: заведите склад с названием машины.',
  },
];

export function ruleFor(kind: NodeKind): NodeKindRule {
  const found = NODE_KIND_RULES.find((rule) => rule.kind === kind);
  // Перечисление и таблица правил лежат рядом и меняются вместе; если сюда
  // всё же попал неизвестный вид, молчать нельзя — данные повреждены.
  if (found === undefined) throw new Error(`Неизвестный вид узла: ${kind}`);
  return found;
}

/** Есть ли у узла рабочая область: план, генплан или окно склада. */
export function hasWorkArea(kind: NodeKind): boolean {
  return ruleFor(kind).planKind !== 'none';
}

/** Что можно создать внутри узла указанного вида. Порядок — как в таблице правил. */
export function allowedChildKinds(parentKind: NodeKind): readonly NodeKind[] {
  return NODE_KIND_RULES.filter((rule) => rule.allowedParents.includes(parentKind)).map(
    (rule) => rule.kind,
  );
}

export function canContain(parentKind: NodeKind, childKind: NodeKind): boolean {
  return ruleFor(childKind).allowedParents.includes(parentKind);
}
