/**
 * Характеристики здания в части пожарной безопасности.
 *
 * Перечень полей и наборы значений заданы данными, а не разложены по коду
 * формы. Из-за этого интерфейс строит карточку здания сам, а добавление нового
 * поля при смене нормативной базы сводится к правке этой таблицы.
 *
 * Значения списков — те, что применяет заказчик: классы функциональной пожарной
 * опасности по 123-ФЗ, степени огнестойкости и классы конструктивной пожарной
 * опасности по СП 2.13130, категории по СП 12.13130.
 * Программа сама ничего из этого не рассчитывает: значения берутся из проекта
 * или из расчёта категорий и указываются пользователем.
 *
 * Смотри docs/02_ТЗ_редакция_3.md, часть 4.
 */

import type { BuildingProfile } from '@izh/contracts';

export type ProfileFieldKind = 'select' | 'multi-select' | 'number' | 'text';

export interface ProfileField {
  readonly key: keyof BuildingProfile;
  readonly title: string;
  readonly kind: ProfileFieldKind;
  /** Набор значений для выпадающего списка. Только для kind = 'select'. */
  readonly options: readonly string[];
  /** Единица измерения, показывается рядом с полем. */
  readonly unit: string | null;
}

const FUNCTIONAL_CLASSES = [
  'Ф1.1', 'Ф1.2', 'Ф1.3', 'Ф1.4',
  'Ф2.1', 'Ф2.2', 'Ф2.3', 'Ф2.4',
  'Ф3.1', 'Ф3.2', 'Ф3.3', 'Ф3.4', 'Ф3.5', 'Ф3.6', 'Ф3.7',
  'Ф4.1', 'Ф4.2', 'Ф4.3', 'Ф4.4',
  'Ф5.1', 'Ф5.2', 'Ф5.3',
];

const PRESENCE = ['есть', 'нет'];

export const BUILDING_PROFILE_FIELDS: readonly ProfileField[] = [
  // Значений может быть несколько: административная часть Ф4.3 и производственная Ф5.1
  // в одном здании — обычное дело. Хранятся в одном поле через запятую.
  {
    key: 'functionalClasses',
    title: 'Классы функциональной пожарной опасности',
    kind: 'multi-select',
    options: FUNCTIONAL_CLASSES,
    unit: null,
  },
  { key: 'fireResistance', title: 'Степень огнестойкости', kind: 'select', options: ['I', 'II', 'III', 'IV', 'V'], unit: null },
  { key: 'constructiveClass', title: 'Класс конструктивной пожарной опасности', kind: 'select', options: ['С0', 'С1', 'С2', 'С3'], unit: null },
  { key: 'floorsAbove', title: 'Этажность (надземных этажей)', kind: 'number', options: [], unit: null },
  { key: 'attic', title: 'Чердак', kind: 'select', options: PRESENCE, unit: null },
  { key: 'mansardFloor', title: 'Мансардный этаж', kind: 'select', options: PRESENCE, unit: null },
  { key: 'floorsBelow', title: 'Подземных этажей', kind: 'number', options: [], unit: null },
  { key: 'heightM', title: 'Высота здания', kind: 'number', options: [], unit: 'м' },
  { key: 'builtAreaM2', title: 'Площадь застройки', kind: 'number', options: [], unit: 'м²' },
  { key: 'volumeM3', title: 'Строительный объём', kind: 'number', options: [], unit: 'м³' },
  // У здания категорий В1–В4 не бывает: по СП 12.13130 на эти классы делятся
  // помещения, а здание в целом относится к А, Б, В, Г или Д.
  {
    key: 'explosionCategory',
    title: 'Категория здания по взрывопожарной опасности',
    kind: 'select',
    options: ['А', 'Б', 'В', 'Г', 'Д', 'не категорируется'],
    unit: null,
  },
  { key: 'categoryBasis', title: 'Основание категории (документ)', kind: 'text', options: [], unit: null },
  // Класс возможного пожара нужен проверке расстановки огнетушителей: по нему
  // и категории выбирается ранг тушения (ППР, приложение № 1).
  {
    key: 'fireClasses',
    title: 'Классы возможного пожара',
    kind: 'multi-select',
    options: ['A', 'B', 'C', 'D', 'E'],
    unit: null,
  },
  { key: 'evacuationExits', title: 'Количество эвакуационных выходов', kind: 'number', options: [], unit: null },
  { key: 'builtYear', title: 'Год постройки', kind: 'number', options: [], unit: null },
  { key: 'responsible', title: 'Ответственный за пожарную безопасность', kind: 'text', options: [], unit: null },
];

export const EMPTY_BUILDING_PROFILE: BuildingProfile = {
  functionalClasses: null,
  fireResistance: null,
  constructiveClass: null,
  floorsAbove: null,
  floorsBelow: null,
  heightM: null,
  builtAreaM2: null,
  volumeM3: null,
  explosionCategory: null,
  categoryBasis: null,
  fireClasses: null,
  attic: null,
  mansardFloor: null,
  evacuationExits: null,
  builtYear: null,
  responsible: null,
};

/**
 * Незаполненные характеристики.
 *
 * Пустые поля не мешают вести журнал: сведения о старом здании собираются
 * постепенно. Но без них нормативные выводы неполны, поэтому дашборд состояния
 * объекта показывает такие здания отдельно.
 */
export function missingProfileFields(profile: BuildingProfile | null): readonly string[] {
  if (profile === null) return BUILDING_PROFILE_FIELDS.map((field) => field.title);
  return BUILDING_PROFILE_FIELDS.filter((field) => profile[field.key] === null).map(
    (field) => field.title,
  );
}
