/**
 * Реестр своих видов элементов (движок E4).
 *
 * Каталог встроенных видов — константа: к их кодам привязаны правила,
 * справочники и печатные формы. Свои виды пользователь заводит в настройках, и
 * знать о них должны те же самые функции: `elementByCode` вызывается из восьми
 * десятков мест — от значка на плане до заголовка колонки журнала.
 *
 * Поэтому здесь заведён один список, который заполняется при загрузке настроек
 * и при их сохранении. Это не «глобальное состояние ради удобства», а кэш
 * пользовательских данных на стороне чтения: единственный, кто его меняет, —
 * оболочка, и делает это ровно там, где настройки прочитаны.
 *
 * Правило детерминированности (AGENTS.md, правило 3) относится к движкам и не
 * нарушено: движки этот модуль не видят. Тесты обязаны возвращать реестр в
 * исходное состояние — для этого есть `resetCustomElementTypes`.
 */

import type { CustomElementType, CustomElementPlacement } from '@izh/contracts';
import type { PlanKind } from '../object-tree/tree-rules.js';

/** Пусто до первой загрузки настроек: у новой организации своих видов нет. */
let registered: readonly CustomElementType[] = [];

/**
 * Заменяет реестр целиком.
 *
 * Целиком, а не по одному: настройки приходят одним документом, и добавление
 * по одному оставило бы удалённый вид в памяти до перезапуска программы.
 */
export function setCustomElementTypes(types: readonly CustomElementType[]): void {
  registered = types;
}

/** Только для тестов: вернуть реестр в исходное состояние. */
export function resetCustomElementTypes(): void {
  registered = [];
}

/** Все заведённые виды, включая выведенные из обращения. */
export function customElementTypes(): readonly CustomElementType[] {
  return registered;
}

/** Виды, которые показываются в библиотеке: выведенные из обращения — нет. */
export function activeCustomElementTypes(): readonly CustomElementType[] {
  return registered.filter((type) => type.archivedAt === null);
}

export function customElementByCode(typeCode: string): CustomElementType | null {
  return registered.find((type) => type.typeCode === typeCode) ?? null;
}

/** Своим ли видом заведён элемент. По коду, без обращения к реестру. */
export function isCustomTypeCode(typeCode: string): boolean {
  return typeCode.startsWith(CUSTOM_TYPE_PREFIX);
}

export const CUSTOM_TYPE_PREFIX = 'custom-';

/**
 * Где показывается свой вид — в понятиях рабочих областей.
 *
 * «Этаж» и «склад» — разные области: на этаже у элемента есть координаты, на
 * складе важен только состав. Пользователь выбирает то и другое отдельно.
 */
const PLACEMENT_TO_PLAN_KIND: Readonly<Record<CustomElementPlacement, PlanKind>> = {
  'генплан': 'general',
  'этаж': 'floor',
  'склад': 'storage',
};

export function planKindsOf(type: CustomElementType): readonly PlanKind[] {
  return type.placements.map((placement) => PLACEMENT_TO_PLAN_KIND[placement]);
}
