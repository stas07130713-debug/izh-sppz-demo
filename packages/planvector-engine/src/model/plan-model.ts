/**
 * PlanModel — цифровая модель этажа.
 *
 * Пункт 17 ТЗ: независимая версионируемая модель со зданием, этажом, стенами,
 * перегородками, дверями, окнами, проёмами, лестницами, помещениями и
 * метаданными; хранит единицы, систему координат, масштаб, геометрию,
 * confidence, источники и историю преобразований.
 *
 * Модель — это то, ради чего существует ядро. Всё остальное в движке лишь
 * способы её получить, поэтому она описана первой и меняется осторожнее всего.
 */

import type { Polygon, Rect, Segment } from './geometry.js';

/** Версия формата. Модель попадает в файлы .planmodel и переживёт не одну
 *  версию программы, поэтому число меняется только вместе с миграцией. */
export const MODEL_VERSION = 1;

/**
 * Виды объектов из пункта 8 ТЗ.
 *
 * Список открытый: пункт 8 прямо требует возможности добавлять новые типы без
 * переработки ядра. Добавление значения сюда не должно ломать ничего, кроме
 * мест, где вид объекта разбирается по случаям.
 */
export type ElementKind =
  | 'WALL_EXT'
  | 'WALL_INT'
  | 'PARTITION'
  | 'DOOR'
  | 'DOOR_SINGLE'
  | 'DOOR_DOUBLE'
  | 'DOOR_SLIDING'
  | 'DOOR_FOLDING'
  | 'DOOR_REVOLVING'
  | 'WINDOW'
  | 'OPENING'
  | 'STAIR'
  | 'STAIR_FLIGHT'
  | 'STAIRCASE'
  | 'BALCONY'
  | 'LOGGIA'
  | 'ELEVATOR'
  | 'SHAFT'
  | 'COLUMN';

/** Единицы, в которых записана геометрия модели. */
export type Units =
  /** Единицы исходного документа: масштаб ещё не известен. */
  | 'source'
  | 'meters';

/** Откуда взялся объект. Пункт 20 ТЗ: исходник не уничтожается, а модель
 *  помнит, что распознано, а что поставлено человеком. */
export type Provenance = 'recognized' | 'manual' | 'imported-cad';

/**
 * Уверенность распознавания, от 0 до 1. Пункт 13 ТЗ.
 *
 * У объектов, поставленных человеком, всегда единица: человек не сомневается
 * в том, что нарисовал сам.
 */
export type Confidence = number;

export interface ElementBase {
  readonly id: string;
  readonly kind: ElementKind;
  readonly confidence: Confidence;
  readonly provenance: Provenance;
  /** Свободные признаки: число полотен, направление открывания, вариант из
   *  библиотеки эталонов. Состав зависит от вида объекта. */
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/** Линейный объект: стена, перегородка, проём, окно, дверь в стене. */
export interface LinearElement extends ElementBase {
  readonly geometry: 'segment';
  readonly segment: Segment;
  /** Толщина в единицах модели. Ноль — толщина неизвестна. */
  readonly thickness: number;
}

/** Площадной объект: лестничная клетка, шахта, колонна, балкон. */
export interface AreaElement extends ElementBase {
  readonly geometry: 'polygon';
  readonly polygon: Polygon;
}

export type PlanElement = LinearElement | AreaElement;

/** Помещение. Пункт 16 ТЗ. */
export interface Room {
  readonly id: string;
  readonly polygon: Polygon;
  /** Площадь и периметр в единицах модели. Считаются, а не вводятся. */
  readonly area: number;
  readonly perimeter: number;
  readonly name: string;
  readonly number: string;
  readonly confidence: Confidence;
  readonly provenance: Provenance;
  /** Идентификаторы соседних помещений и объектов, связанных с помещением. */
  readonly neighbourRoomIds: readonly string[];
  readonly boundaryElementIds: readonly string[];
}

/** Масштаб модели. Пункт 14 ТЗ. */
export interface ScaleInfo {
  /** Сколько метров в одной единице исходного документа. Пусто — не определён. */
  readonly metersPerSourceUnit: number | null;
  readonly method: 'text' | 'dimension-line' | 'two-points' | 'building-extents' | 'none';
  /** Пользователь подтвердил автоматически найденный масштаб. */
  readonly confirmedByUser: boolean;
  readonly note: string;
}

/** Ссылка на исходный документ. Сам документ хранится вне модели. */
export interface SourceRef {
  readonly fileName: string;
  /** SHA-256 содержимого: модель всегда знает, из чего сделана. */
  readonly contentHash: string;
  readonly kind: 'pdf' | 'image' | 'cad';
  readonly pageNumber: number;
  /** Область исходного документа, из которой построена модель. */
  readonly area: Rect | null;
}

/** Одна запись истории преобразований. Пункт 17 ТЗ. */
export interface HistoryEntry {
  readonly at: string;
  readonly stage: string;
  readonly summary: string;
}

export interface FloorModel {
  readonly id: string;
  readonly name: string;
  /** Отметка этажа в метрах. Пусто — неизвестна. */
  readonly elevation: number | null;
  readonly elements: readonly PlanElement[];
  readonly rooms: readonly Room[];
}

export interface BuildingModel {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorModel[];
}

export interface PlanModel {
  readonly version: number;
  readonly id: string;
  readonly createdAt: string;
  readonly units: Units;
  readonly scale: ScaleInfo;
  readonly source: SourceRef;
  readonly building: BuildingModel;
  readonly history: readonly HistoryEntry[];
  /** Профиль распознавания из пункта 11 ТЗ. */
  readonly profile: 'TECHNICAL_PLAN' | 'EVACUATION_PLAN';
  readonly metadata: Readonly<Record<string, string>>;
}

/** Пустая модель — отправная точка конвейера. */
export function createEmptyPlanModel(input: {
  id: string;
  createdAt: string;
  source: SourceRef;
  profile: PlanModel['profile'];
  buildingName?: string;
  floorName?: string;
}): PlanModel {
  return {
    version: MODEL_VERSION,
    id: input.id,
    createdAt: input.createdAt,
    units: 'source',
    scale: { metersPerSourceUnit: null, method: 'none', confirmedByUser: false, note: '' },
    source: input.source,
    profile: input.profile,
    building: {
      id: `${input.id}-b`,
      name: input.buildingName ?? '',
      floors: [
        {
          id: `${input.id}-f1`,
          name: input.floorName ?? '',
          elevation: null,
          elements: [],
          rooms: [],
        },
      ],
    },
    history: [],
    metadata: {},
  };
}

/** Добавляет запись в историю преобразований, не изменяя исходную модель. */
export function withHistory(model: PlanModel, entry: HistoryEntry): PlanModel {
  return { ...model, history: [...model.history, entry] };
}
