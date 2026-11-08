/**
 * Каскадный справочник моделей: вид оборудования → модель/типоразмер
 * (ТЗ, Дополнение 3, часть К6).
 *
 * Данные, а не код формы — тот же принцип, что у `ELEMENT_CATALOG` и
 * `RULE_PACKAGE`: расширяется дополнением списка, без изменения интерфейса.
 * Обозначения — стандартные типоразмеры по ГОСТ Р 51057 (переносные) и
 * ГОСТ Р 51017 (передвижные), они не нормативный срок и не требуют сверки
 * периодичности: это просто наименования моделей, как их печатают на этикетке.
 *
 * Только вид оборудования, для которого здесь есть список, получает в
 * карточке объекта выпадающий список модели вместо свободного текста —
 * для остальных 24 из 28 типов каталога справочник ещё не собран, и текстовое
 * поле остаётся честной заменой, а не выдумывает список, которого нет.
 *
 * Модели BONTEL взяты из официального руководства по эксплуатации
 * огнетушителей ОВЭ BONTEL производителя.
 */

export interface ModelOption {
  readonly code: string;
  readonly title: string;
}

const EXTINGUISHER_POWDER_MODELS: readonly ModelOption[] = [
  { code: 'ОП-2', title: 'ОП-2 — переносной' },
  { code: 'ОП-3', title: 'ОП-3 — переносной' },
  { code: 'ОП-4', title: 'ОП-4 — переносной' },
  { code: 'ОП-5', title: 'ОП-5 — переносной' },
  { code: 'ОП-8', title: 'ОП-8 — переносной' },
  { code: 'ОП-9', title: 'ОП-9 — переносной' },
  { code: 'ОП-10', title: 'ОП-10 — переносной' },
  { code: 'ОП-35', title: 'ОП-35 — передвижной' },
  { code: 'ОП-50', title: 'ОП-50 — передвижной' },
  { code: 'ОП-100', title: 'ОП-100 — передвижной' },
];

const EXTINGUISHER_CO2_MODELS: readonly ModelOption[] = [
  { code: 'ОУ-2', title: 'ОУ-2 — переносной' },
  { code: 'ОУ-3', title: 'ОУ-3 — переносной' },
  { code: 'ОУ-5', title: 'ОУ-5 — переносной' },
  { code: 'ОУ-6', title: 'ОУ-6 — переносной' },
  { code: 'ОУ-8', title: 'ОУ-8 — переносной' },
  { code: 'ОУ-10', title: 'ОУ-10 — переносной' },
  { code: 'ОУ-20', title: 'ОУ-20 — передвижной' },
  { code: 'ОУ-40', title: 'ОУ-40 — передвижной' },
  { code: 'ОУ-80', title: 'ОУ-80 — передвижной' },
];

const EXTINGUISHER_WATER_MODELS: readonly ModelOption[] = [
  { code: 'ОВ-5', title: 'ОВ-5 — водный, переносной' },
  { code: 'ОВ-9', title: 'ОВ-9 — водный, переносной' },
];

const EXTINGUISHER_FOAM_MODELS: readonly ModelOption[] = [
  { code: 'ОВП-4', title: 'ОВП-4 — воздушно-пенный, переносной' },
  { code: 'ОВП-5', title: 'ОВП-5 — воздушно-пенный, переносной' },
  { code: 'ОВП-10', title: 'ОВП-10 — воздушно-пенный, переносной' },
  { code: 'ОВП-100', title: 'ОВП-100 — воздушно-пенный, передвижной' },
];

const EXTINGUISHER_BONTEL_MODELS: readonly ModelOption[] = [
  { code: 'ОВЭ-1(з)-АВСЕ-01 BONTEL', title: 'ОВЭ-1(з)-АВСЕ-01 BONTEL' },
  { code: 'ОВЭ-2(з)-АВСЕ-01 BONTEL', title: 'ОВЭ-2(з)-АВСЕ-01 BONTEL' },
  { code: 'ОВЭ-5(з)-АВСЕ-01 BONTEL', title: 'ОВЭ-5(з)-АВСЕ-01 BONTEL' },
  { code: 'ОВЭ-10(з)-АВСЕ-01 BONTEL', title: 'ОВЭ-10(з)-АВСЕ-01 BONTEL' },
];

const MODEL_CATALOG: Readonly<Record<string, readonly ModelOption[]>> = {
  'extinguisher-powder': EXTINGUISHER_POWDER_MODELS,
  'extinguisher-co2': EXTINGUISHER_CO2_MODELS,
  'extinguisher-water': EXTINGUISHER_WATER_MODELS,
  'extinguisher-foam': EXTINGUISHER_FOAM_MODELS,
  'extinguisher-bantl': EXTINGUISHER_BONTEL_MODELS,
};

/** Список моделей вида оборудования. Пустой массив — справочника для него ещё нет. */
export function modelsFor(typeCode: string): readonly ModelOption[] {
  return MODEL_CATALOG[typeCode] ?? [];
}
