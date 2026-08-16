/**
 * PlanVector Engine — локальное ядро реконструкции планов зданий.
 *
 * Реализуется по ТЗ PlanVector_Engine_TZ_v1.0, этапами из пункта 28.
 * Готовы этапы 1 (архитектура) и 2 (PlanModel).
 *
 * У пакета нет ни одной зависимости — ни от основной программы, ни от
 * сторонних библиотек. Это условие пункта 2: ядро должно быть отделяемо в
 * самостоятельный продукт.
 */

export * from './source/page-content.js';
export * from './analyze/text-analysis.js';
export * from './analyze/plan-area.js';
export * from './analyze/analyze-page.js';
export * from './recognize/trace-segments.js';
export * from './recognize/build-walls.js';
export * from './recognize/build-model.js';
export * from './render/render-svg.js';
export * from './model/geometry.js';
export * from './model/plan-model.js';
export * from './model/scale.js';
export * from './model/validate.js';
export * from './api.js';


