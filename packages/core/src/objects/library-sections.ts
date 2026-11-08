/**
 * Разделы библиотеки элементов (ТЗ, Дополнение 6).
 *
 * Один сплошной список не читается: противопожарные элементы и системы пожарной
 * автоматики заводятся по-разному и разными людьми. Элемент ставят поштучно
 * перетаскиванием; система начинается с прибора, а её оборудование заводится
 * составом в карточке этого прибора.
 *
 * Раздел назывался «первичные средства» — по ППР это огнетушители, краны, щиты
 * и песок. В нём же оказались противопожарные двери, самоспасатели и
 * огнезащитная обработка, которые первичными средствами не являются, и
 * название стало неверным.
 *
 * Разделение это и показывает, а не просто группирует по алфавиту.
 */

import type { ElementType } from './element-catalog.js';

export type LibrarySection = 'противопожарные элементы' | 'системы пожарной автоматики' | 'автономное пожаротушение';

export interface LibraryGroup {
  readonly section: LibrarySection;
  /** Пояснение под заголовком: чем этот раздел отличается по способу заведения. */
  readonly note: string | null;
  readonly items: readonly ElementType[];
}

/** Порядок внутри раздела противопожарных элементов — как их называет заказчик. */
const PRIMARY_ORDER: readonly string[] = [
  'extinguisher', 'fire-hydrant-indoor', 'fire-door', 'self-rescuer',
];

function sectionOf(typeCode: string): LibrarySection {
  if (typeCode === 'autonomous-suppression') return 'автономное пожаротушение';
  if (typeCode === 'control-panel') return 'системы пожарной автоматики';
  return 'противопожарные элементы';
}

const SECTION_NOTES: Readonly<Record<LibrarySection, string | null>> = {
  'противопожарные элементы': null,
  'системы пожарной автоматики':
    'Система начинается с прибора. Перенесите его на план — состав системы задаётся в его карточке.',
  'автономное пожаротушение':
    'Срабатывает без прибора управления и обслуживается отдельно. Вид установки выбирается в карточке.',
};

const SECTION_ORDER: readonly LibrarySection[] = [
  'противопожарные элементы', 'системы пожарной автоматики', 'автономное пожаротушение',
];

/**
 * Раскладывает набор элементов по разделам, сохраняя заданный порядок.
 *
 * Пустые разделы не возвращаются: на генплане нет ни систем, ни автономных
 * установок, и заголовок над пустотой только занимал бы место.
 */
export function librarySections(items: readonly ElementType[]): readonly LibraryGroup[] {
  return SECTION_ORDER
    .map((section) => ({
      section,
      note: SECTION_NOTES[section],
      items: items
        .filter((item) => sectionOf(item.typeCode) === section)
        .sort((a, b) => order(a.typeCode) - order(b.typeCode)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Заданный порядок, остальные — следом, как в каталоге. */
function order(typeCode: string): number {
  const index = PRIMARY_ORDER.indexOf(typeCode);
  return index === -1 ? PRIMARY_ORDER.length : index;
}
