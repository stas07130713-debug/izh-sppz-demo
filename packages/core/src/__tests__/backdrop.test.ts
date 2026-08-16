/**
 * Эталонные тесты сценариев работы с подложкой.
 *
 * Они описывают договорённость: что именно происходит при загрузке файла и при
 * задании масштаба. Если тест покраснел — поведение программы изменилось.
 */

import { describe, expect, it } from 'vitest';
import type { BackdropDeps } from '../backdrop-deps.js';
import { createBackdropFromImage, createBackdropFromPdf } from '../create-backdrop.js';
import { calibrateByDrawingScale, calibrateByTwoPoints } from '../calibrate-backdrop.js';
import {
  FIXED_NOW,
  fakeBackdropRepository,
  fakeClock,
  fakeEngine,
  fakeFileStore,
  fakeIdGenerator,
  pdfBytes,
  pngBytes,
  type FakeEngineOptions,
} from './test-doubles.js';

function makeDeps(engineOptions: FakeEngineOptions = {}): BackdropDeps {
  return {
    engine: fakeEngine(engineOptions),
    fileStore: fakeFileStore(),
    backdrops: fakeBackdropRepository(),
    clock: fakeClock(),
    ids: fakeIdGenerator(),
  };
}

describe('создание подложки из PDF', () => {
  it('сохраняет и исходный файл, и изображение подложки', async () => {
    const deps = makeDeps();
    const result = await createBackdropFromPdf(deps, {
      sourceBytes: pdfBytes(500),
      sourceFileName: 'План 1 этажа.pdf',
      pageNumber: 1,
      dpi: 150,
      extraRotationDeg: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.sourceHash).toBe('pdf-500');
    expect(result.value.imageHash).toBe('png-1000');
    expect(result.value.sourceHash).not.toBe(result.value.imageHash);
  });

  it('записывает сведения о подложке целиком', async () => {
    const deps = makeDeps();
    const result = await createBackdropFromPdf(deps, {
      sourceBytes: pdfBytes(500),
      sourceFileName: 'План 1 этажа.pdf',
      pageNumber: 1,
      dpi: 150,
      extraRotationDeg: 90,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual({
      id: 'id-1',
      sourceHash: 'pdf-500',
      sourceFileName: 'План 1 этажа.pdf',
      sourceKind: 'pdf',
      pageNumber: 1,
      dpi: 150,
      rotationDeg: 90,
      crop: null,
      widthPx: 4967,
      heightPx: 3509,
      imageHash: 'png-1000',
      createdAt: FIXED_NOW,
    });
  });

  it('подложка попадает в хранилище и её можно прочитать обратно', async () => {
    const deps = makeDeps();
    const created = await createBackdropFromPdf(deps, {
      sourceBytes: pdfBytes(),
      sourceFileName: 'план.pdf',
      pageNumber: 1,
      dpi: 150,
      extraRotationDeg: 0,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const list = await deps.backdrops.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(1);
    expect(list.value[0]?.id).toBe(created.value.id);
  });

  it('отклоняет файл, который не является PDF', async () => {
    const deps = makeDeps();
    const result = await createBackdropFromPdf(deps, {
      sourceBytes: pngBytes(),
      sourceFileName: 'картинка.png',
      pageNumber: 1,
      dpi: 150,
      extraRotationDeg: 0,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('при сбое построения подложки ничего не сохраняет', async () => {
    const deps = makeDeps({ rasterizeError: true });
    const result = await createBackdropFromPdf(deps, {
      sourceBytes: pdfBytes(),
      sourceFileName: 'план.pdf',
      pageNumber: 1,
      dpi: 150,
      extraRotationDeg: 0,
    });

    expect(result.ok).toBe(false);

    const list = await deps.backdrops.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(0);
  });
});

describe('создание подложки из картинки', () => {
  it('разрешение остаётся неизвестным, файл сохраняется один раз', async () => {
    const deps = makeDeps();
    const result = await createBackdropFromImage(deps, {
      sourceBytes: pngBytes(300),
      sourceFileName: 'скан плана.png',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.dpi).toBe(null);
    expect(result.value.sourceKind).toBe('image');
    // Исходный файл и изображение подложки — это один и тот же файл.
    expect(result.value.sourceHash).toBe(result.value.imageHash);
  });

  it('отклоняет PDF, поданный как картинка', async () => {
    const deps = makeDeps();
    const result = await createBackdropFromImage(deps, {
      sourceBytes: pdfBytes(),
      sourceFileName: 'план.pdf',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_FORMAT');
  });
});

describe('задание масштаба', () => {
  async function makeBackdrop(deps: BackdropDeps, dpi: number) {
    const created = await createBackdropFromPdf(deps, {
      sourceBytes: pdfBytes(),
      sourceFileName: 'план.pdf',
      pageNumber: 1,
      dpi,
      extraRotationDeg: 0,
    });
    if (!created.ok) throw new Error('подготовка теста не удалась');
    return created.value;
  }

  it('по двум точкам: 200 пикселей на 20 метров даёт 0,1 м на пиксель', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps, 150);

    const result = await calibrateByTwoPoints(deps, {
      backdropId: backdrop.id,
      twoPoints: { a: { x: 100, y: 100 }, b: { x: 300, y: 100 }, realDistanceM: 20 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metersPerPixel).toBeCloseTo(0.1, 10);
    expect(result.value.method).toBe('two-points');
    expect(result.value.drawingScale).toBe(null);
  });

  it('по масштабу чертежа: 1:100 при 150 dpi', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps, 150);

    const result = await calibrateByDrawingScale(deps, {
      backdropId: backdrop.id,
      scaleDenominator: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metersPerPixel).toBeCloseTo(0.016933, 6);
    expect(result.value.method).toBe('drawing-scale');
    expect(result.value.twoPoints).toBe(null);
  });

  it('масштаб чертежа недоступен для подложки из картинки', async () => {
    const deps = makeDeps();
    const created = await createBackdropFromImage(deps, {
      sourceBytes: pngBytes(),
      sourceFileName: 'скан.png',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await calibrateByDrawingScale(deps, {
      backdropId: created.value.id,
      scaleDenominator: 100,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_ARGUMENT');
  });

  it('масштаб сохраняется и читается обратно', async () => {
    const deps = makeDeps();
    const backdrop = await makeBackdrop(deps, 150);

    await calibrateByTwoPoints(deps, {
      backdropId: backdrop.id,
      twoPoints: { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, realDistanceM: 25 },
    });

    const stored = await deps.backdrops.getCalibration(backdrop.id);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value?.metersPerPixel).toBeCloseTo(0.05, 10);
  });

  it('для несуществующей подложки масштаб задать нельзя', async () => {
    const deps = makeDeps();
    const result = await calibrateByTwoPoints(deps, {
      backdropId: 'несуществующая',
      twoPoints: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, realDistanceM: 10 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});
