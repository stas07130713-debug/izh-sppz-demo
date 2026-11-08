/**
 * Формулировки выводов проверки расстановки огнетушителей.
 *
 * Расчёт отделён от слов: `placement-check.ts` решает, что с помещением, а
 * здесь это превращается в строки, которые прочитает человек. Смешивать их в
 * одном файле накладно — правка формулировки не должна касаться расчёта.
 *
 * Нарушения и замечания не смешиваются. «Ранг ниже требуемого» — вывод о норме;
 * «в карточке не заполнен ранг» — вывод о данных, и пока карточку не заполнили,
 * программа не вправе объявлять ни соответствие, ни нарушение.
 */

import type { PlanObject, Room } from '@izh/contracts';
import type { RoomCoverage } from './coverage.js';
import type { ExtinguisherFitness } from './extinguisher-fitness.js';
import type { RoomRequirement } from './room-requirement.js';

/** Пункты, по которым делаются выводы. */
export const PPR_409 = 'ППР РФ № 1479, пункт 409';
export const PPR_APP_1 = 'ППР РФ № 1479, приложение № 1';
export const PPR_APP_2 = 'ППР РФ № 1479, приложение № 2';

/** Огнетушитель считается защитой, только если он исправен. */
export const WORKING_STATES: readonly string[] = ['исправен', 'исправен с замечаниями'];

export type FindingSeverity = 'нарушение' | 'замечание' | 'сведения';

/**
 * Чем чинится вывод: что именно нужно задать.
 *
 * По этому полю интерфейс ставит кнопку рядом с замечанием. Без него
 * человеку сообщали, что масштаб не задан, и оставляли искать, где он
 * задаётся.
 */
export type PlacementFix = 'масштаб' | 'обводка' | 'здание' | 'категория' | 'назначение' | 'классы';

export interface PlacementFinding {
  readonly severity: FindingSeverity;
  readonly text: string;
  /** Пункт норматива, по которому сделан вывод. */
  readonly clause: string;
  /** Что задать, чтобы замечание ушло. Нет — чинится не настройкой. */
  readonly fix?: PlacementFix;
  /**
   * Объект, о котором вывод. По нему открывается карточка прямо из перечня.
   *
   * Без этого человек читал «28-10: не заполнен ранг» и шёл искать 28-10 по
   * журналу — а исправить нужно именно его карточку.
   */
  readonly objectId?: string;
  /** Как назвать объект в перечне: «ОП-8 № 28-10». */
  readonly objectTitle?: string;
}

export interface RoomFacts {
  readonly room: Room;
  readonly requirement: RoomRequirement;
  readonly nearby: readonly { readonly object: PlanObject; readonly fitness: ExtinguisherFitness }[];
  readonly suitable: readonly { readonly object: PlanObject; readonly fitness: ExtinguisherFitness }[];
  readonly coverage: RoomCoverage | null;
  readonly radiusPx: number | null;
  /**
   * Считается объект целиком, а не помещение.
   *
   * Тогда об обводке и масштабе молчим: обводить нечего, расстояния и так не
   * считаются, а замечание «помещение не обведено» про объект целиком
   * читается как ошибка программы.
   */
  readonly wholeObject?: boolean;
}

/** Причина приходит фразой с маленькой буквы — здесь она начинает предложение. */
function capitalize(text: string | null): string {
  if (text === null || text === '') return '';
  return text[0]?.toUpperCase() + text.slice(1);
}

export function collectRoomFindings(findings: PlacementFinding[], facts: RoomFacts): void {
  const { requirement, nearby, suitable, coverage } = facts;

  if (facts.wholeObject === true) {
    // Обводки у объекта целиком нет и быть не может.
  } else if (facts.room.outline === null) {
    findings.push({
      severity: 'замечание',
      text: 'Помещение не обведено на плане — расстояние до огнетушителей не проверяется.',
      clause: PPR_409,
      fix: 'обводка',
    });
  } else if (facts.radiusPx === null) {
    findings.push({
      severity: 'замечание',
      text: 'Не задан масштаб плана — расстояние в метрах не считается.',
      clause: PPR_409,
      fix: 'масштаб',
    });
  }

  /*
   * Выводы об оборудовании называют предмет так, как его назвал бы человек:
   * «ОП-8 № 28-10», а не один учётный номер. Номер сам по себе не говорит, о
   * чём речь, а в перечне из тридцати строк это единственная зацепка.
   *
   * И объясняют, что делать. «Не заполнен ранг тушения» — это не про
   * оборудование, а про карточку: огнетушитель может быть исправен, а
   * подтвердить, тот ли он, нечем.
   */
  for (const item of nearby) {
    const about = {
      objectId: item.object.id,
      objectTitle: `${item.fitness.mark} № ${item.object.regNumber ?? "без номера"}`,
    };

    if (item.fitness.verdict === 'не подходит') {
      findings.push({
        ...about,
        severity: 'нарушение',
        text: `Не подходит для этого места: ${item.fitness.reason ?? "ранг ниже требуемого"}. Здесь нужен огнетушитель с рангом не ниже ${requirement.rankText}.`,
        clause: PPR_APP_1,
      });
    }
    if (item.fitness.verdict === 'нет сведений') {
      findings.push({
        ...about,
        severity: 'замечание',
        // Причина приходит из расчёта пригодности: она называет вычисленный
        // ранг и то, чего до нормы не хватает. Своего текста здесь быть не
        // должно — он разошёлся бы с тем, что показано в карточке.
        text: `Нельзя подтвердить, что он подходит. ${capitalize(item.fitness.reason)}`.trim(),
        clause: PPR_APP_1,
      });
    }
    if (!WORKING_STATES.includes(item.object.technicalState)) {
      findings.push({
        ...about,
        severity: 'нарушение',
        text: item.object.technicalState === 'не определено'
          ? 'Состояние не определено: проверка не проводилась, и защитой такой огнетушитель считать нельзя. Проведите проверку — состояние проставится по её итогу.'
          : `Состояние «${item.object.technicalState}»: в работе такой огнетушитель не считается защитой. Отправьте его в ремонт и поставьте на место подменный.`,
        clause: PPR_409,
      });
    }
  }

  if (coverage !== null && coverage.sampled > 0 && coverage.ratio < 1) {
    const percent = Math.round(coverage.ratio * 100);
    findings.push({
      severity: 'нарушение',
      text: suitable.length === 0
        ? `В помещении нет ни одного подходящего огнетушителя в пределах ${requirement.reachM} м.`
        : `Расстояние до огнетушителя больше ${requirement.reachM} м на части площади: покрыто ${percent} %.`,
      clause: PPR_409,
    });
  }

  if (requirement.mobile !== null) {
    const mobile = nearby.filter((item) => item.fitness.execution === 'передвижной');
    const need = requirement.mobile.sets;
    const halved = requirement.halved ? ' (уменьшено вдвое: помещение под АУП)' : '';
    if (mobile.length < need) {
      findings.push({
        severity: 'нарушение',
        text: `Нужен другой вид огнетушителей: площадь больше предельной защищаемой (${requirement.mobile.limitAreaM2} м²), и по приложению № 2 требуются передвижные — ${need} комплектов${halved}, размещено ${mobile.length}. Переносные их не заменяют: у передвижных своя огнетушащая способность, и нормируются они площадью, а не расстоянием — круга нормы у них поэтому и нет.`,
        clause: PPR_APP_2,
      });
    }
  }
}
