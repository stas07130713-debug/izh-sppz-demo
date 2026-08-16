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
import { inspectPdfPage, probePdf } from './pdf-probe.js';
import { probeImage, rasterizePdfPage } from './raster.js';
import {
  estimateRasterSize,
  metersPerPixelFromDrawingScale,
  metersPerPixelFromTwoPoints,
} from './scale-math.js';

export const planSourceEngine: PlanSourceEngine = {
  name: 'E1 Подложки планов',
  version: '0.1.0',
  detectKind,
  probePdf,
  inspectPdfPage,
  estimateRasterSize,
  rasterizePdfPage,
  probeImage,
  metersPerPixelFromTwoPoints,
  metersPerPixelFromDrawingScale,
};

export { setPdfWorkerPort, isPdfWorkerConfigured } from './pdfjs-setup.js';
export { DPI_PRESETS, MAX_BACKDROP_MEGAPIXELS, MAX_BACKDROP_SIDE_PX, pixelsPerMeter } from './scale-math.js';
export { classifyPageContent } from './content-signals.js';
