/**
 * Единый источник значков оборудования — один на всю программу.
 *
 * Заказчик (пункт 1 перечня доработок): «во всех экспортируемых документах
 * использовать те же значки огнетушителей и других элементов СППЗ, которые
 * используются в интерфейсе программы… не создавать для Word/PDF отдельные
 * упрощённые или автоматически генерируемые значки… экспорт должен
 * использовать единый источник графических ресурсов с интерфейсом программы».
 *
 * Отсюда и отдельный файл. Прежде выбор значка жил внутри самого React-значка,
 * и всё, что рисуется не в разметке — схема расположения для приложения к
 * справке, — рисовало своё: красный квадрат вместо переданного заказчиком
 * знака. Теперь выбор один, а кто и как его рисует — дело вызывающего.
 *
 * Порядок выбора значим и одинаков везде:
 *
 *  1. картинка своего вида (движок E4) — вид завёл пользователь, и знак его;
 *  2. замена, назначенная пользователем встроенному виду, — он для того её и
 *     назначил;
 *  3. встроенный знак из таблицы ниже.
 *
 * Ничего не нашлось — значка нет, и вид рисуется буквенной пометкой.
 */
import { customElementByCode, elementByCode } from '@izh/core';
import { elementIconOverride } from './element-icon-overrides';
import icon01 from '../assets/element-icons/01.png';
import icon02 from '../assets/element-icons/02.png';
import icon03 from '../assets/element-icons/03.png';
import icon04 from '../assets/element-icons/04.png';
import icon05 from '../assets/element-icons/05.png';
import icon07 from '../assets/element-icons/07.png';
import icon08 from '../assets/element-icons/08.png';
import icon09 from '../assets/element-icons/09.png';
import icon10 from '../assets/element-icons/10.png';
import icon11 from '../assets/element-icons/11.png';
import icon13 from '../assets/element-icons/13.png';
import icon14 from '../assets/element-icons/14.png';
import icon15 from '../assets/element-icons/15.png';
import icon16 from '../assets/element-icons/16.png';
import icon17 from '../assets/element-icons/17.png';
import icon18 from '../assets/element-icons/18.png';
import iconF06 from '../assets/element-icons/f06-fire-equipment.svg';
import iconF07 from '../assets/element-icons/f07-water-source.svg';
import iconOZ from '../assets/element-icons/oz-fireproofing.svg';
import iconF08 from '../assets/element-icons/f08-autonomous-suppression.svg';
import iconExit from '../assets/element-icons/exit-safety.svg';
import iconEvacuationPlan from '../assets/element-icons/evacuation-plan.svg';

/**
 * Значок вида оборудования.
 *
 * Экспортируется ради проверки согласованности: у подвидов одного семейства
 * значок обязан совпадать с общим видом. Иначе уточнение вида в карточке меняло
 * бы обозначение на плане, и схему приходилось бы читать заново.
 */
export const ICONS: Readonly<Record<string, string>> = {
  hydrant: icon01,
  'water-reservoir': iconF07,
  'water-tank': iconF07,
  'water-pond': iconF07,
  'water-natural': iconF07,
  'pump-station': icon02,
  'fire-truck-connection': icon03,
  'outdoor-ladder': icon04,
  'roof-fence': icon05,
  'outdoor-cabinet': iconF06,
  'fire-board-a': iconF06,
  'fire-board-v': iconF06,
  'fire-board-e': iconF06,
  'fire-board-sh': iconF06,
  'fire-board-mobile': iconF06,
  'outdoor-cabinet-box': iconF06,
  extinguisher: icon07,
  'extinguisher-water': icon07,
  'extinguisher-foam': icon07,
  'extinguisher-emulsion': icon07,
  'extinguisher-powder': icon07,
  'extinguisher-co2': icon07,
  'extinguisher-halon': icon07,
  'extinguisher-bantl': icon07,
  'fire-hydrant-indoor': icon08,
  'self-rescuer': icon09,
  'self-rescuer-filter': icon09,
  'self-rescuer-isolating': icon09,
  'smoke-valve': icon10,
  'damper-fire': icon10,
  'damper-smoke': icon10,
  'damper-dual': icon10,
  'damper-pressure': icon10,
  'fire-door': icon11,
  fireproofing: iconOZ,
  'smoke-detector': icon13,
  'fire-detector': icon13,
  'combined-detector': icon13,
  'gas-detector': icon13,
  'aspiration-detector': icon13,
  'heat-detector': icon13,
  'flame-detector': icon13,
  'manual-call-point': icon14,
  'control-panel': icon15,
  'fire-post': icon15,
  sprinkler: icon16,
  'fire-suppression-system': icon16,
  'powder-module': icon16,
  'gas-module': icon16,
  'aup-sprinkler': icon16,
  'aup-drencher': icon16,
  'aup-sprinkler-drencher': icon16,
  'aup-mist': icon16,
  'aup-foam': icon16,
  'aup-gas': icon16,
  'aup-powder': icon16,
  'aup-aerosol': icon16,
  'aup-combined': icon16,
  'aup-robotic': icon16,
  // Автономная установка нарочно другого цвета: она не входит ни в одну
  // систему и обслуживается сама по себе — это должно быть видно на плане
  // сразу, без чтения подписи.
  // Все подвиды по огнетушащему веществу — одним значком. Вид ОТВ виден в
  // карточке и в журнале; менять из-за него обозначение на плане значило бы
  // заставлять читать схему заново после каждого уточнения в карточке.
  'autonomous-suppression': iconF08,
  'suppression-powder': iconF08,
  'suppression-gas': iconF08,
  'suppression-aerosol': iconF08,
  'suppression-water': iconF08,
  'suppression-mist': iconF08,
  sounder: icon17,
  'sounder-audible': icon17,
  'sounder-speech': icon17,
  'sounder-light': icon17,
  'sounder-combined': icon17,
  'smoke-fan': icon18,
  'fan-exhaust': icon18,
  'fan-supply': icon18,
  exit: iconExit,
  'evacuation-plan': iconEvacuationPlan,
};


/**
 * Значок вида: путь к картинке или `null`.
 *
 * `null` означает «рисуйте буквенной пометкой»: цветной квадрат с буквами
 * (`mark` и `color` вида) — запасной вариант, а не отдельное обозначение.
 */
export function elementIconSource(typeCode: string): string | null {
  const own = customElementByCode(typeCode)?.iconDataUrl ?? null;
  return own ?? elementIconOverride(typeCode) ?? builtInElementIconSource(typeCode);
}

/** Штатный значок — запасной вариант, если сохранённая пользователем картинка повреждена. */
export function builtInElementIconSource(typeCode: string): string | null {
  return ICONS[typeCode] ?? null;
}

/** Буквенная пометка вида: чем рисовать, когда картинки нет. */
export function elementIconFallback(typeCode: string): { readonly mark: string; readonly color: string } {
  const element = elementByCode(typeCode);
  return { mark: element?.mark ?? '?', color: element?.color ?? '#64748b' };
}
