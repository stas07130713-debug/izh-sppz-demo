/** Подтипы, которые выбираются в карточке одной общей строки библиотеки. */
export interface EquipmentFamilyOptions {
  readonly label: string;
  readonly codes: readonly string[];
  readonly options: readonly {
    readonly code: string;
    readonly title: string;
    /**
     * Заголовок группы в списке. Нужен там, где вариантов больше десятка:
     * установок пожаротушения семь видов, и рядом с ними стоит оборудование
     * этих установок — без разделителя одно читается как другое.
     */
    readonly group?: string;
  }[];
}

const FAMILIES: readonly EquipmentFamilyOptions[] = [
  {
    label: 'Тип огнетушителя',
    codes: ['extinguisher', 'extinguisher-powder', 'extinguisher-foam', 'extinguisher-water', 'extinguisher-emulsion', 'extinguisher-co2', 'extinguisher-halon', 'extinguisher-bantl'],
    options: [
      { code: 'extinguisher', title: 'не определён' },
      { code: 'extinguisher-powder', title: 'порошковый' },
      { code: 'extinguisher-foam', title: 'пенный' },
      { code: 'extinguisher-water', title: 'водный' },
      { code: 'extinguisher-emulsion', title: 'воздушно-эмульсионный' },
      { code: 'extinguisher-co2', title: 'углекислотный' },
      { code: 'extinguisher-halon', title: 'хладоновый' },
      { code: 'extinguisher-bantl', title: 'воздушно-эмульсионный BONTEL' },
    ],
  },
  {
    label: 'Тип пожарного извещателя',
    codes: ['fire-detector', 'smoke-detector', 'heat-detector', 'flame-detector', 'combined-detector', 'gas-detector', 'aspiration-detector'],
    options: [
      { code: 'fire-detector', title: 'не определён' },
      { code: 'smoke-detector', title: 'дымовой' },
      { code: 'heat-detector', title: 'тепловой' },
      { code: 'flame-detector', title: 'пламени' },
      { code: 'combined-detector', title: 'комбинированный (дым и тепло)' },
      { code: 'gas-detector', title: 'газовый' },
      { code: 'aspiration-detector', title: 'аспирационный' },
    ],
  },
  {
    label: 'Вид оповещателя',
    codes: ['sounder', 'sounder-audible', 'sounder-speech', 'sounder-light', 'sounder-combined'],
    options: [
      { code: 'sounder', title: 'не определён' },
      { code: 'sounder-audible', title: 'звуковой' },
      { code: 'sounder-speech', title: 'речевой' },
      { code: 'sounder-light', title: 'световой' },
      { code: 'sounder-combined', title: 'свето-звуковой' },
    ],
  },
  {
    // Виды автоматических установок пожаротушения по СП 485.1311500.2020
    // (газовые и порошковые), ГОСТ Р 50680 (водяные), ГОСТ Р 50800 (пенные).
    // Ниже, отдельной группой, — оборудование самих установок: ороситель и
    // модули. Смешивать их в одном списке нельзя: установка и её ороситель —
    // разные вещи, а стояли бы рядом как равные.
    label: 'Вид системы пожаротушения',
    codes: [
      'fire-suppression-system',
      'aup-sprinkler', 'aup-drencher', 'aup-sprinkler-drencher', 'aup-mist',
      'aup-foam', 'aup-gas', 'aup-powder', 'aup-aerosol', 'aup-combined', 'aup-robotic',
      'sprinkler', 'powder-module', 'gas-module',
    ],
    options: [
      { code: 'fire-suppression-system', title: 'не определён' },
      { code: 'aup-sprinkler', title: 'спринклерная водяного пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-drencher', title: 'дренчерная водяного пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-sprinkler-drencher', title: 'спринклерно-дренчерная', group: 'Установки пожаротушения' },
      { code: 'aup-mist', title: 'тонкораспылённой водой', group: 'Установки пожаротушения' },
      { code: 'aup-foam', title: 'пенного пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-gas', title: 'газового пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-powder', title: 'порошкового пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-aerosol', title: 'аэрозольного пожаротушения', group: 'Установки пожаротушения' },
      { code: 'aup-combined', title: 'комбинированная', group: 'Установки пожаротушения' },
      { code: 'aup-robotic', title: 'роботизированная', group: 'Установки пожаротушения' },
      { code: 'sprinkler', title: 'ороситель', group: 'Оборудование установок' },
      { code: 'powder-module', title: 'модуль порошкового пожаротушения', group: 'Оборудование установок' },
      { code: 'gas-module', title: 'модуль газового пожаротушения', group: 'Оборудование установок' },
    ],
  },
  {
    // Вид огнетушащего вещества модульной установки. Выбирается здесь, как
    // заряд у огнетушителя: от него зависит и состав работ, и сроки, и второго
    // места для той же величины в карточке быть не должно.
    label: 'Вид огнетушащего вещества (ОТВ)',
    codes: [
      'autonomous-suppression', 'suppression-powder', 'suppression-gas',
      'suppression-aerosol', 'suppression-water', 'suppression-mist',
    ],
    options: [
      { code: 'autonomous-suppression', title: 'не определён' },
      { code: 'suppression-powder', title: 'порошковое' },
      { code: 'suppression-gas', title: 'газовое' },
      { code: 'suppression-aerosol', title: 'аэрозольное' },
      { code: 'suppression-water', title: 'водяное' },
      { code: 'suppression-mist', title: 'тонкораспылённая вода' },
    ],
  },
  {
    label: 'Вид противодымного клапана',
    codes: ['smoke-valve', 'damper-fire', 'damper-smoke', 'damper-dual', 'damper-pressure'],
    options: [
      { code: 'smoke-valve', title: 'не определён' },
      { code: 'damper-fire', title: 'огнезадерживающий (нормально открытый)' },
      { code: 'damper-smoke', title: 'дымовой (нормально закрытый)' },
      { code: 'damper-dual', title: 'двойного действия' },
      { code: 'damper-pressure', title: 'избыточного давления' },
    ],
  },
  {
    label: 'Вид вентилятора',
    codes: ['smoke-fan', 'fan-exhaust', 'fan-supply'],
    options: [
      { code: 'smoke-fan', title: 'не определён' },
      { code: 'fan-exhaust', title: 'дымоудаления, вытяжной' },
      { code: 'fan-supply', title: 'подпора воздуха, приточный' },
    ],
  },
  {
    label: 'Вид самоспасателя',
    codes: ['self-rescuer', 'self-rescuer-filter', 'self-rescuer-isolating'],
    options: [
      { code: 'self-rescuer', title: 'не определён' },
      { code: 'self-rescuer-filter', title: 'фильтрующий' },
      { code: 'self-rescuer-isolating', title: 'изолирующий' },
    ],
  },
  {
    label: 'Тип водоисточника',
    codes: ['water-reservoir', 'water-pond', 'water-tank', 'water-natural'],
    options: [
      { code: 'water-pond', title: 'пожарный водоём' },
      { code: 'water-tank', title: 'пожарный резервуар' },
      { code: 'water-natural', title: 'естественный водоисточник' },
      // «Другое» здесь — общий вид: источник заведён, а чем он является,
      // ещё не выяснено или не подходит ни под одно название.
      { code: 'water-reservoir', title: 'другое' },
    ],
  },
  {
    label: 'Вид щита',
    codes: ['outdoor-cabinet', 'fire-board-a', 'fire-board-v', 'fire-board-e', 'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box'],
    options: [
      { code: 'outdoor-cabinet', title: 'не определён' },
      { code: 'fire-board-a', title: 'ЩП-А — очаги класса А' },
      { code: 'fire-board-v', title: 'ЩП-В — очаги класса В' },
      { code: 'fire-board-e', title: 'ЩП-Е — электроустановки' },
      { code: 'fire-board-sh', title: 'ЩП-СХ — сельскохозяйственный' },
      { code: 'fire-board-mobile', title: 'ЩПП — передвижной' },
      { code: 'outdoor-cabinet-box', title: 'шкаф пожарный наружный' },
    ],
  },
];

export function familyOptionsFor(typeCode: string): EquipmentFamilyOptions | null {
  return FAMILIES.find((family) => family.codes.includes(typeCode)) ?? null;
}
