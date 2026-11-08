/**
 * Семейства оборудования: общий вид и его исполнения.
 *
 * Огнетушитель бывает водный, порошковый, углекислотный; извещатель — дымовой,
 * тепловой, пламени; установка пожаротушения — спринклерная, порошковая,
 * газовая. Для человека это один вид оборудования с разновидностями, а для
 * регламента — разные сроки и разный состав работ: у водного огнетушителя
 * перезарядка раз в год, у порошкового раз в пять лет.
 *
 * Поэтому в конструкторе они показываются раскрывающейся строкой: общий вид
 * сверху, исполнения под ним. Настраивается исполнение, а общий вид служит
 * заголовком.
 *
 * Состав семейств задан списком, а не выведен из кода системы. Вывести не
 * получается: у огнетушителей и покрывала для изоляции очага один код «01», а
 * порошковый и газовый модули относятся к установке пожаротушения, имея коды
 * «08» и «07». Угаданное правило рано или поздно отнесло бы оборудование не
 * туда, и человек настроил бы сроки не тому.
 */

export interface ElementFamily {
  /** Общий вид, служащий заголовком: сам по себе не настраивается. */
  readonly parent: string;
  /** Исполнения по порядку показа. */
  readonly members: readonly string[];
}

export const ELEMENT_FAMILIES: readonly ElementFamily[] = [
  {
    parent: 'extinguisher',
    members: [
      'extinguisher-water', 'extinguisher-foam', 'extinguisher-emulsion',
      'extinguisher-powder', 'extinguisher-co2', 'extinguisher-halon', 'extinguisher-bantl',
    ],
  },
  {
    parent: 'fire-detector',
    members: [
      'smoke-detector', 'heat-detector', 'flame-detector',
      'combined-detector', 'gas-detector', 'aspiration-detector',
    ],
  },
  {
    parent: 'sounder',
    members: ['sounder-audible', 'sounder-speech', 'sounder-light', 'sounder-combined'],
  },
  {
    parent: 'fire-suppression-system',
    members: [
      'aup-sprinkler',
      'aup-drencher',
      'aup-sprinkler-drencher',
      'aup-mist',
      'aup-foam',
      'aup-gas',
      'aup-powder',
      'aup-aerosol',
      'aup-combined',
      'aup-robotic',
      'sprinkler', 'powder-module', 'gas-module',
    ],
  },
  {
    parent: 'autonomous-suppression',
    members: [
      'suppression-powder', 'suppression-gas', 'suppression-aerosol',
      'suppression-water', 'suppression-mist',
    ],
  },
  {
    parent: 'smoke-valve',
    members: ['damper-fire', 'damper-smoke', 'damper-dual', 'damper-pressure'],
  },
  {
    parent: 'smoke-fan',
    members: ['fan-exhaust', 'fan-supply'],
  },
  {
    parent: 'self-rescuer',
    members: ['self-rescuer-filter', 'self-rescuer-isolating'],
  },
  {
    parent: 'water-reservoir',
    members: ['water-pond', 'water-tank', 'water-natural'],
  },
  {
    parent: 'outdoor-cabinet',
    members: [
      'fire-board-a', 'fire-board-v', 'fire-board-e',
      'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box',
    ],
  },
];

/** Семейство, к которому принадлежит вид: как исполнение или как заголовок. */
/**
 * Виды пожарных извещателей.
 *
 * Взяты из семейства, а не переписаны отдельным списком: два перечня одного и
 * того же разошлись бы при первой же правке каталога.
 */
export const FIRE_DETECTOR_TYPES: readonly string[] =
  ELEMENT_FAMILIES.find((family) => family.parent === 'fire-detector')?.members ?? [];

export function familyOf(typeCode: string): ElementFamily | null {
  return ELEMENT_FAMILIES.find(
    (family) => family.parent === typeCode || family.members.includes(typeCode),
  ) ?? null;
}

/** Является ли вид заголовком семейства: настраивается не он, а его исполнения. */
export function isFamilyParent(typeCode: string): boolean {
  return ELEMENT_FAMILIES.some((family) => family.parent === typeCode);
}

/** Входит ли вид в семейство как исполнение. */
export function isFamilyMember(typeCode: string): boolean {
  return ELEMENT_FAMILIES.some((family) => family.members.includes(typeCode));
}
