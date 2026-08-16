/**
 * Эталонные тесты очистки подложки и калибровки по габаритам здания.
 */

import { describe, expect, it } from 'vitest';
import type { BackdropDeps } from '../backdrop-deps.js';
import { createBackdropFromPdf } from '../create-backdrop.js';
import { applyBackdropCleanup, resetBackdropCleanup } from '../cleanup-backdrop.js';
import { calibrateByBuildingExtents } from '../calibrate-backdrop.js';
import {
  fakeBackdropRepository,
  fakeClock,
  fakeEngine,
  fakeFileStore,
  fakeIdGenerator,
  pdfBytes,
  type FakeEngineOptions,
} from './test-doubles.js';

/** Настройки очистки от цветного «обычной» силы — как в интерфейсе по умолчанию. */
const REMOVE_COLORED = {
  kind: 'remove-colored' as const,
  saturationThreshold: 0.15,
  haloRadiusPx: 1,
  symbolGrowthPx: 6,
};

function makeDeps(engineOptions: FakeEngineOptions = {}): BackdropDeps {
  return {
    engine: fakeEngine(engineOptions),
    fileStore: fakeFileStore(),
    backdrops: fakeBackdropRepository(),
    clock: fakeClock(),
    ids: fakeIdGenerator(),
  };
}

async function makeBackdrop(deps: BackdropDeps) {
  const created = await createBackdropFromPdf(deps, {
    sourceBytes: pdfBytes(),
    sourceFileName: 'план эвакуации.pdf',
    pageNumber: 1,
    dpi: 150,
    extraRotationDeg: 0,
  });
  if (!created.ok) throw new Error('подготовка теста не удалась');
  return created.value;
}

describe('очистка подложки', () => {
  it('сохраняет очищенное изображение отдельным файлом', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const result = await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [{ kind: 'crop', rect: { x: 0, y: 0, widthPx: 400, heightPx: 300 } }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cleanedImageHash).not.toBe(backdrop.imageHash);
  });

  it('если очистка ничего не изменила, новый файл не создаётся', async () => {
    // Хранилище адресует файлы по содержимому, поэтому одинаковый результат —
    // это тот же самый файл. Так и должно быть: место не расходуется впустую.
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const result = await applyBackdropCleanup(deps, { backdropId: backdrop.id, operations: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cleanedImageHash).toBe(backdrop.imageHash);
  });

  it('исходное изображение остаётся в хранилище нетронутым', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [REMOVE_COLORED],
    });

    const original = await deps.fileStore.get(backdrop.imageHash);
    expect(original.ok).toBe(true);
  });

  it('обрезка меняет размеры подложки', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const result = await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [{ kind: 'crop', rect: { x: 10, y: 10, widthPx: 400, heightPx: 300 } }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.widthPx).toBe(400);
    expect(result.value.heightPx).toBe(300);
  });

  it('список действий сохраняется целиком — очистку можно поправить позже', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const operations = [
      { kind: 'crop' as const, rect: { x: 0, y: 0, widthPx: 500, heightPx: 400 } },
      REMOVE_COLORED,
      { kind: 'erase-rect' as const, rect: { x: 0, y: 0, widthPx: 100, heightPx: 80 } },
    ];

    await applyBackdropCleanup(deps, { backdropId: backdrop.id, operations });

    const stored = await deps.backdrops.getCleanup(backdrop.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value?.operations).toEqual(operations);
  });

  it('повторная очистка считается от исходного изображения, а не от предыдущего результата', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const first = await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [{ kind: 'crop', rect: { x: 0, y: 0, widthPx: 400, heightPx: 300 } }],
    });
    // Второй раз обрезка убрана из списка — подложка обязана вернуться к полному размеру.
    const second = await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [REMOVE_COLORED],
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.widthPx).toBe(400);
    expect(second.value.widthPx).toBeGreaterThan(400);
  });

  it('отмена очистки убирает её полностью', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [REMOVE_COLORED],
    });
    await resetBackdropCleanup(deps, backdrop.id);

    const stored = await deps.backdrops.getCleanup(backdrop.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value).toBe(null);
  });

  it('при нечитаемом изображении ничего не сохраняется', async () => {
    const deps = makeDeps({ decodeError: true });
    const backdrop = await makeBackdrop(deps);

    const result = await applyBackdropCleanup(deps, {
      backdropId: backdrop.id,
      operations: [REMOVE_COLORED],
    });

    expect(result.ok).toBe(false);
    const stored = await deps.backdrops.getCleanup(backdrop.id);
    expect(stored.ok && stored.value).toBe(null);
  });
});

describe('масштаб по габаритам здания', () => {
  it('здание 60 на 30 метров в прямоугольнике 600 на 300 точек', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const result = await calibrateByBuildingExtents(deps, {
      backdropId: backdrop.id,
      extents: {
        rect: { x: 100, y: 50, widthPx: 600, heightPx: 300 },
        horizontalMeters: 60,
        verticalMeters: 30,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.method).toBe('building-extents');
    expect(result.value.metersPerPixel).toBeCloseTo(0.1, 10);
    expect(result.value.discrepancyPercent).toBeCloseTo(0, 6);
  });

  it('расхождение по направлениям сохраняется — это признак ошибки ввода', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    const result = await calibrateByBuildingExtents(deps, {
      backdropId: backdrop.id,
      extents: {
        rect: { x: 0, y: 0, widthPx: 600, heightPx: 300 },
        horizontalMeters: 60,
        verticalMeters: 33,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.discrepancyPercent).toBeGreaterThan(9);
  });

  it('введённые габариты сохраняются, чтобы их можно было поправить', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps);

    await calibrateByBuildingExtents(deps, {
      backdropId: backdrop.id,
      extents: {
        rect: { x: 0, y: 0, widthPx: 600, heightPx: 300 },
        horizontalMeters: 60,
        verticalMeters: 30,
      },
    });

    const stored = await deps.backdrops.getCalibration(backdrop.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value?.buildingExtents?.horizontalMeters).toBe(60);
    expect(stored.value?.buildingExtents?.verticalMeters).toBe(30);
  });
});


