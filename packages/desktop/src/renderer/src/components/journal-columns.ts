/**
 * Графы сведений карточки в журнале (ТЗ, Дополнение 6, часть С34).
 *
 * Одно описание на таблицу и на выгрузку. Раньше их было два: таблица
 * показывала графы по видам, а выгрузка сваливала сведения огнетушителя в
 * «Примечание» и про остальные виды не знала вовсе. В печатном журнале от
 * этого выходила ерунда: данные карточки оказывались в примечании, а
 * собственные графы пропадали.
 *
 * Графа описана значением, а не разметкой: таблица рисует её ячейкой, выгрузка
 * пишет колонкой, и оба берут одно и то же.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import { SYSTEM_HEAD_TYPE, elementByCode, isExtinguisherType } from '@izh/core';
import {
  barrierCardSummary, controlPanelCardSummary, extinguisherCardSummary, fireBoardCardSummary,
  fireproofingCardSummary, hydrantCardSummary, ladderCardSummary, lastServiceSummary,
  outdoorHydrantCardSummary, pumpStationCardSummary, roofFenceCardSummary, suppressionCardSummary,
  waterSourceCardSummary,
} from './journal-summaries';

export interface JournalCardColumn {
  readonly title: string;
  readonly value: (object: PlanObject, events: readonly MaintenanceEvent[]) => string;
}

const WATER_SOURCES = ['water-reservoir', 'water-pond', 'water-tank', 'water-natural'];
const FIRE_BOARDS = [
  'outdoor-cabinet', 'fire-board-a', 'fire-board-v', 'fire-board-e',
  'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box',
];

/**
 * Какие графы карточки показывать у этого вида оборудования.
 *
 * Считается по виду строки, а не по выбранной вкладке: в общем списке рядом
 * стоят разделы разных видов, и у каждого свои графы — у гидранта сеть и
 * образец, у водоёма объём и забор воды.
 */
export function cardColumnsFor(typeCode: string): readonly JournalCardColumn[] {
  if (typeCode.startsWith('extinguisher-')) {
    return [
      { title: 'Последний исполнитель / акт', value: (object, events) => lastServiceSummary(object, events) },
      { title: 'Данные карточки огнетушителя', value: (object) => extinguisherCardSummary(object) },
    ];
  }
  if (typeCode === 'fire-hydrant-indoor') {
    return [{ title: 'Данные карточки крана', value: (object) => hydrantCardSummary(object) }];
  }
  if (typeCode === 'fire-door') {
    return [{ title: 'Вид преграды и предел огнестойкости', value: (object) => barrierCardSummary(object) }];
  }
  // Вид ОТВ выражен подвидом установки, и графа открывается по подвиду.
  if (typeCode.startsWith('suppression-')) {
    return [{ title: 'Зона, пуск, обнаружение', value: (object) => suppressionCardSummary(object) }];
  }
  if (typeCode === SYSTEM_HEAD_TYPE) {
    return [{ title: 'Исполнение и резервное питание', value: (object) => controlPanelCardSummary(object) }];
  }
  if (typeCode === 'hydrant') {
    return [{ title: 'Сеть, образец, высота', value: (object) => outdoorHydrantCardSummary(object) }];
  }
  if (WATER_SOURCES.includes(typeCode)) {
    return [{ title: 'Объём, забор воды, площадка', value: (object) => waterSourceCardSummary(object) }];
  }
  if (typeCode === 'outdoor-ladder') {
    return [{ title: 'Тип, место, размеры', value: (object) => ladderCardSummary(object) }];
  }
  if (typeCode === 'roof-fence') {
    return [{ title: 'Кровля, высота, длина', value: (object) => roofFenceCardSummary(object) }];
  }
  if (FIRE_BOARDS.includes(typeCode)) {
    return [{ title: 'Место и комплектность', value: (object) => fireBoardCardSummary(object) }];
  }
  if (typeCode === 'pump-station') {
    return [{ title: 'Назначение, насосы, управление', value: (object) => pumpStationCardSummary(object) }];
  }
  if (typeCode === 'fireproofing') {
    return [{ title: 'Состав, площадь, срок действия', value: (object) => fireproofingCardSummary(object) }];
  }
  return [];
}

/**
 * Что стоит в графе «Наименование».
 *
 * У огнетушителя — название вида: «Огнетушитель порошковый». Заказчик: «в
 * графе Наименование нужно оставить только вид огнетушителя, его
 * производителя — в графе данные карточки». Марка и изготовитель у
 * огнетушителей ведутся всегда, и графа превращалась в перечень моделей, по
 * которому не видно, что это за оборудование.
 *
 * У прочего оборудования марка остаётся: у извещателя или клапана она и есть
 * то, чем предмет называют, а вид без неё («Извещатель пожарный») ничего не
 * добавляет к соседней графе с видом.
 */
export function journalName(object: PlanObject): string {
  const title = elementByCode(object.typeCode)?.title ?? object.typeCode;
  if (isExtinguisherType(object.typeCode)) return title;
  return object.model ?? title;
}
