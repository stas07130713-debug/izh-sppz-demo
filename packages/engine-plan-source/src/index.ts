/**
 * Движок E1 «Подложки планов».
 *
 * Собирает разрозненные функции в один объект, соответствующий контракту
 * PlanSourceEngine. Ядро и интерфейс работают только через этот контракт и не
 * знают, что внутри используется pdf.js — поэтому библиотеку можно заменить,
 * не трогая остальную программу.
 */

import type { PlanSourceEngine } from '@izh/contracts';
import { detectKind } from './detect-kind.js';
import { applyCleanup, downscale, samplePalette } from './image-ops.js';
import { inspectPdfPage, probePdf } from './pdf-probe.js';
import { decodeImage, encodePng, probeImage, rasterizePdfPage } from './raster.js';
import {
  estimateRasterSize,
  measureByBuildingExtents,
  metersPerPixelFromDrawingScale,
  metersPerPixelFromTwoPoints,
} from './scale-math.js';

export const planSourceEngine: PlanSourceEngine = {
  name: 'E1 Подложки планов',
  version: '0.2.0',
  detectKind,
  probePdf,
  inspectPdfPage,
  estimateRasterSize,
  rasterizePdfPage,
  probeImage,
  metersPerPixelFromTwoPoints,
  metersPerPixelFromDrawingScale,
  measureByBuildingExtents,
  decodeImage,
  encodePng,
  applyCleanup,
  downscale,
  samplePalette,
};

export { setPdfWorkerPort, isPdfWorkerConfigured } from './pdfjs-setup.js';
export {
  DPI_PRESETS,
  EXTENTS_DISCREPANCY_WARNING_PERCENT,
  MAX_BACKDROP_MEGAPIXELS,
  MAX_BACKDROP_SIDE_PX,
  MIN_EXTENTS_SIDE_PX,
  pixelsPerMeter,
} from './scale-math.js';
export { classifyPageContent } from './content-signals.js';
export { cropImage, eraseRect, keepDark, removeColor, removeColored } from './image-ops.js';
