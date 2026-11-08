/**
 * Правила конструктора своих видов элементов (движок E4).
 *
 * Проверки живут в ядре, а не в форме настроек: описание вида попадает в
 * карточки, в журнал и в печатные формы, и вид без названия или с двумя
 * одинаковыми полями сломает их все разом — но не в момент заведения, а
 * месяцем позже, при выгрузке отчёта.
 *
 * Ошибки возвращаются целыми предложениями и по-русски: их читает не
 * программист, а ответственный за пожарную безопасность.
 */

import type { CustomElementType, CustomField, IsoDateTime, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import { CUSTOM_TYPE_PREFIX } from './custom-element-registry.js';

/** Сколько знаков помещается на значке плана. */
const MARK_MAX = 5;

/**
 * Предел на картинку значка.
 *
 * Настройки — один документ JSON, который читается при каждом запуске.
 * Несжатая фотография на пять мегабайт замедлила бы запуск и раздула файл
 * настроек до неоткрываемого. Форма уменьшает картинку до значка, а предел
 * ловит то, что пришло другим путём: перенос настроек, правка файла руками.
 */
const ICON_MAX_BYTES = 128 * 1024;

export interface CustomElementDraft {
  readonly typeCode: string | null;
  readonly title: string;
  readonly mark: string;
  readonly color: string;
  readonly iconDataUrl: string | null;
  readonly placements: readonly CustomElementType['placements'][number][];
  readonly fields: readonly CustomField[];
  readonly note: string | null;
}

export interface SaveCustomElementInput {
  readonly draft: CustomElementDraft;
  /** Уже заведённые виды: по ним проверяется неповторимость названия. */
  readonly existing: readonly CustomElementType[];
  readonly now: IsoDateTime;
  /** Новый код вида. Передаётся снаружи: ядро не выдумывает идентификаторы само. */
  readonly newTypeCode: string;
}

/**
 * Собирает вид из введённого, проверив всё, что нельзя проверить потом.
 *
 * Возвращает готовую запись, а не «да/нет»: иначе форме пришлось бы собирать
 * её второй раз, и два сборщика разошлись бы.
 */
export function buildCustomElement(input: SaveCustomElementInput): Result<CustomElementType> {
  const { draft } = input;

  const title = draft.title.trim();
  if (title === '') return err('INVALID_ARGUMENT', 'Укажите название вида — оно будет стоять в журнале и в карточке.');

  const mark = draft.mark.trim();
  if (mark === '') return err('INVALID_ARGUMENT', 'Укажите пометку на значке — короткие буквы вроде «ОП» или «ЯП».');
  if (mark.length > MARK_MAX) {
    return err('INVALID_ARGUMENT', `Пометка длиннее ${MARK_MAX} знаков на значке плана не помещается.`);
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
    return err('INVALID_ARGUMENT', 'Выберите цвет значка.');
  }

  // Пометка и цвет обязательны и при заданной картинке: они остаются
  // запасным обозначением там, где картинка не к месту, — и в списках.
  const icon = draft.iconDataUrl;
  if (icon !== null) {
    if (!icon.startsWith('data:image/')) {
      return err('INVALID_ARGUMENT', 'Значок должен быть картинкой: PNG, JPEG или SVG.');
    }
    if (icon.length > ICON_MAX_BYTES) {
      return err('INVALID_ARGUMENT', 'Картинка значка слишком большая. Выберите изображение поменьше.');
    }
  }

  if (draft.placements.length === 0) {
    return err('INVALID_ARGUMENT', 'Укажите, где применяется вид: генплан, этаж или склад. Иначе он не появится ни в одной библиотеке.');
  }

  const typeCode = draft.typeCode ?? input.newTypeCode;
  if (!typeCode.startsWith(CUSTOM_TYPE_PREFIX)) {
    return err('INVALID_ARGUMENT', 'Код своего вида должен начинаться с «custom-»: так он не столкнётся со встроенными.');
  }

  // Одинаковые названия разных видов путают в журнале: там от вида остаётся
  // только название, и две строки «Ящик с песком» неотличимы.
  const twin = input.existing.find((type) => type.typeCode !== typeCode
    && type.archivedAt === null
    && type.title.trim().toLowerCase() === title.toLowerCase());
  if (twin !== undefined) {
    return err('CONFLICT', `Вид с названием «${title}» уже заведён. Название должно быть своим у каждого вида.`);
  }

  const fields = checkFields(draft.fields);
  if (!fields.ok) return fields;

  const before = input.existing.find((type) => type.typeCode === typeCode) ?? null;

  return ok({
    typeCode,
    title,
    mark,
    color: draft.color,
    iconDataUrl: icon,
    placements: draft.placements,
    fields: fields.value,
    note: draft.note === null || draft.note.trim() === '' ? null : draft.note.trim(),
    createdAt: before?.createdAt ?? input.now,
    updatedAt: input.now,
    archivedAt: before?.archivedAt ?? null,
  });
}

/** Проверяет состав полей карточки и приводит их к чистому виду. */
function checkFields(fields: readonly CustomField[]): Result<readonly CustomField[]> {
  const clean: CustomField[] = [];
  const seenTitles = new Set<string>();
  const seenIds = new Set<string>();

  for (const field of fields) {
    const title = field.title.trim();
    if (title === '') return err('INVALID_ARGUMENT', 'У каждого поля карточки должно быть название.');

    const key = title.toLowerCase();
    if (seenTitles.has(key)) {
      return err('CONFLICT', `Поле «${title}» встречается дважды. Названия полей в карточке не повторяются.`);
    }
    seenTitles.add(key);

    if (field.id.trim() === '') return err('INVALID_ARGUMENT', `У поля «${title}» нет внутреннего ключа.`);
    if (seenIds.has(field.id)) {
      return err('CONFLICT', `Внутренний ключ поля «${title}» повторяется. Заведите поле заново.`);
    }
    seenIds.add(field.id);

    // Список без вариантов — поле, которое нечем заполнить: выпадающий список
    // откроется пустым, и человек решит, что программа сломалась.
    const options = field.kind === 'список'
      ? field.options.map((option) => option.trim()).filter((option) => option !== '')
      : [];
    if (field.kind === 'список' && options.length < 2) {
      return err('INVALID_ARGUMENT', `У поля «${title}» нужно не меньше двух вариантов выбора.`);
    }
    if (new Set(options).size !== options.length) {
      return err('CONFLICT', `У поля «${title}» повторяются варианты выбора.`);
    }

    clean.push({
      id: field.id,
      title,
      kind: field.kind,
      options,
      unit: field.kind === 'число' && field.unit !== null && field.unit.trim() !== '' ? field.unit.trim() : null,
      hint: field.hint === null || field.hint.trim() === '' ? null : field.hint.trim(),
    });
  }

  return ok(clean);
}

/**
 * Заменяет вид в списке или добавляет новый.
 *
 * Список настроек переписывается целиком, поэтому сборка списка — отдельное
 * правило: вставка «в конец, если нет» повторялась бы в форме и в сценарии.
 */
export function upsertCustomElement(
  existing: readonly CustomElementType[],
  type: CustomElementType,
): readonly CustomElementType[] {
  const at = existing.findIndex((item) => item.typeCode === type.typeCode);
  if (at < 0) return [...existing, type];
  return existing.map((item, index) => (index === at ? type : item));
}

/**
 * Выводит вид из обращения или возвращает в него.
 *
 * Физического удаления нет (AGENTS.md, правило 10): на вид ссылаются заведённые
 * объекты и записи журнала эксплуатации, а журнал не правится задним числом.
 */
export function setCustomElementArchived(
  existing: readonly CustomElementType[],
  typeCode: string,
  archivedAt: IsoDateTime | null,
): readonly CustomElementType[] {
  return existing.map((item) => (item.typeCode === typeCode ? { ...item, archivedAt } : item));
}

/**
 * Как убрать свой вид из настроек.
 *
 * Заказчик: «при выведении из обращения элемента удаляй его полностью (из
 * истории), не нужно отображать в настройках». И позже, о конкретном виде:
 * «нельзя удалить ящик с песком. Пишет, что необходимо сначала вывести его из
 * эксплуатации. Но нигде я не нашёл по дереву, что у нас есть этот ящик».
 *
 * Второе — прямое следствие прежнего правила и его ошибка. Считались все
 * единицы вида, включая выведенные из эксплуатации, а совет давался «выведите
 * из эксплуатации». Человек выводил единицу, она пропадала из дерева — и вид
 * всё равно не удалялся, потому что счётчик её по-прежнему считал. Совет вёл
 * в тупик, а искать единицу в дереве было уже негде.
 *
 * Поэтому исходов три, и каждый честен:
 *
 *  1. По виду ничего не заведено — вид удаляется начисто, будто его и не было.
 *  2. Есть единицы в работе — сначала их выводят из эксплуатации или переносят
 *     в другой вид. Совет выполним: он относится к тем, кого видно в дереве.
 *  3. Все единицы выведены из эксплуатации — вид убирается из настроек и из
 *     библиотеки, но само описание остаётся в хранилище. Ставить новые единицы
 *     этого вида уже нельзя, а прежние записи читаются: без описания в журнале
 *     на месте названия осталось бы «Неизвестный вид (custom-…)», а журнал
 *     предъявляют при проверке, и графа «наименование» в нём должна читаться.
 *
 * Третий исход — это `setCustomElementArchived`, и для пользователя он выглядит
 * тем же удалением: вид уходит с экрана и больше не мешает.
 */
export type CustomElementRemoval =
  /** Ничего не заведено: вид удаляется из настроек начисто. */
  | 'убрать совсем'
  /** Единицы есть, но все сняты: вид прячется, описание остаётся ради журнала. */
  | 'убрать из настроек'
  /** Есть единицы в работе: сначала снять их с эксплуатации. */
  | 'сначала снять с эксплуатации';

/** Что нужно знать о виде, чтобы решить его судьбу. */
export interface CustomElementUsageObject {
  readonly typeCode: string;
  readonly archivedAt: IsoDateTime | null;
}

export interface CustomElementUsage {
  readonly removal: CustomElementRemoval;
  /** Всего единиц вида — и в работе, и снятых. */
  readonly objectCount: number;
  /** Из них в работе: именно эти видно в дереве, о них и говорит подсказка. */
  readonly activeCount: number;
  /** Из них выведено из эксплуатации. */
  readonly archivedCount: number;
}

export function customElementUsage(
  typeCode: string,
  objects: readonly CustomElementUsageObject[],
): CustomElementUsage {
  const own = objects.filter((object) => object.typeCode === typeCode);
  const activeCount = own.filter((object) => object.archivedAt === null).length;
  const archivedCount = own.length - activeCount;

  const removal: CustomElementRemoval = activeCount > 0
    ? 'сначала снять с эксплуатации'
    : archivedCount > 0 ? 'убрать из настроек' : 'убрать совсем';

  return { removal, objectCount: own.length, activeCount, archivedCount };
}

/** Убирает вид из списка совсем. Проверку делает вызывающий. */
export function removeCustomElement(
  existing: readonly CustomElementType[],
  typeCode: string,
): readonly CustomElementType[] {
  return existing.filter((item) => item.typeCode !== typeCode);
}
