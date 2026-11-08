/**
 * Централизованный справочник огнетушителей: изготовитель → модель →
 * срок службы по паспорту → официальная ссылка на паспорт.
 *
 * Данные редактируются только в fire_extinguisher_reference_v1.json. PDF-файлы
 * не храним локально: в справочнике допустимы только официальные URL.
 */

import type { PlanObject } from '@izh/contracts';
import referenceData from './fire_extinguisher_reference_v1.json';
import type { ModelOption } from './model-catalog.js';

export interface ExtinguisherReferenceModel {
  readonly manufacturerId: string;
  readonly manufacturerName: string;
  readonly officialSite: string;
  readonly type: string;
  readonly typeCode: string;
  readonly model: string;
  /**
   * Заряд ОТВ по обозначению модели: «ОП-4» — четыре.
   *
   * В обозначении огнетушителя число после марки и есть заряд, так его и
   * читают на объекте. Раз оно уже известно из справочника, спрашивать его
   * ещё раз у человека незачем — а ранг считается именно по нему.
   */
  readonly charge: number | null;
  readonly serviceLifeYears: number | null;
  /** Страница изделия на сайте изготовителя. Открывается всегда, когда известна. */
  readonly officialUrl: string | null;
  /** Паспорт или руководство файлом. Есть далеко не у всех: большинство заводов их не выкладывает. */
  readonly passportUrl: string | null;
  readonly passportSource: string;
  readonly passportRevision: string | null;
  readonly notes: string;
}

export interface ExtinguisherManufacturerOption {
  readonly id: string;
  readonly name: string;
}

interface ReferenceSeries {
  readonly type: string;
  readonly sizes: readonly string[];
  readonly brand: string;
  readonly serviceLifeYears: number | null;
  readonly officialUrl?: string | null;
  readonly passportUrl: string | null;
  readonly passportSource: string;
  readonly passportRevision: string | null;
  readonly notes: string;
}

interface ReferenceManufacturer {
  readonly manufacturerId: string;
  readonly manufacturerName: string;
  readonly officialSite: string;
  /**
   * Хосты, с которых изготовитель раздаёт свои файлы, кроме хоста сайта.
   *
   * У BONTEL страница живёт на bontel.ru, а руководство — на bontel.effinity-back.ru:
   * это хранилище того же сайта. Без списка такая ссылка отбрасывалась бы как чужая,
   * а брать что угодно с любого хоста нельзя — тогда правило «только официальное»
   * перестаёт что-либо значить.
   */
  readonly documentHosts?: readonly string[];
  readonly series: readonly ReferenceSeries[];
}

interface ReferenceFile {
  readonly version: string;
  readonly manufacturers: readonly ReferenceManufacturer[];
}

const REFERENCE = referenceData as ReferenceFile;
const MANUFACTURERS = REFERENCE.manufacturers;

const FLAT_MODELS: readonly ExtinguisherReferenceModel[] = MANUFACTURERS.flatMap((manufacturer) =>
  manufacturer.series.flatMap((series) => series.sizes.map((size) => ({
    manufacturerId: manufacturer.manufacturerId,
    manufacturerName: manufacturer.manufacturerName,
    officialSite: manufacturer.officialSite,
    type: series.type,
    typeCode: typeCodeForMark(series.type),
    model: `${series.type}-${size} ${series.brand}`,
    charge: chargeOf(size),
    serviceLifeYears: series.serviceLifeYears,
    officialUrl: officialLink(series.officialUrl ?? null, manufacturer),
    passportUrl: officialLink(series.passportUrl, manufacturer),
    passportSource: series.passportSource,
    passportRevision: series.passportRevision,
    notes: series.notes,
  }))),
);

export function extinguisherManufacturers(): readonly ExtinguisherManufacturerOption[] {
  return MANUFACTURERS.map((manufacturer) => ({ id: manufacturer.manufacturerId, name: manufacturer.manufacturerName }));
}

/** Изготовители, у которых в справочнике есть хотя бы одна модель выбранного вида. */
export function extinguisherManufacturersForType(typeCode: string): readonly ExtinguisherManufacturerOption[] {
  return MANUFACTURERS
    .filter((manufacturer) => manufacturer.series.some((series) => modelAppliesToType(typeCodeForMark(series.type), typeCode)))
    .map((manufacturer) => ({ id: manufacturer.manufacturerId, name: manufacturer.manufacturerName }));
}

export function extinguisherManufacturerName(manufacturerId: string): string | null {
  return MANUFACTURERS.find((manufacturer) => manufacturer.manufacturerId === manufacturerId)?.manufacturerName ?? null;
}

export function extinguisherModelsForManufacturer(manufacturerId: string, typeCode: string): readonly ModelOption[] {
  return FLAT_MODELS
    .filter((model) => model.manufacturerId === manufacturerId && modelAppliesToType(model.typeCode, typeCode))
    .map((model) => ({ code: model.model, title: model.model }));
}

export function extinguisherReferenceByManufacturerAndModel(
  manufacturerName: string | null | undefined,
  modelName: string | null | undefined,
): ExtinguisherReferenceModel | null {
  const manufacturer = manufacturerName?.trim().toLocaleLowerCase('ru') ?? '';
  const model = modelName?.trim().toLocaleLowerCase('ru') ?? '';
  if (manufacturer === '' || model === '') return null;
  return FLAT_MODELS.find((entry) =>
    entry.manufacturerName.toLocaleLowerCase('ru') === manufacturer
    && entry.model.toLocaleLowerCase('ru') === model) ?? null;
}

export function extinguisherReferenceModelsForType(typeCode: string): readonly ModelOption[] {
  return FLAT_MODELS
    .filter((model) => modelAppliesToType(model.typeCode, typeCode))
    .map((model) => ({ code: model.model, title: model.model }));
}

export function serviceLifeYearsOf(object: PlanObject): number | null {
  if (object.serviceLifeYears !== undefined && object.serviceLifeYears !== null) return object.serviceLifeYears;
  if (object.serviceLifeMonths !== undefined && object.serviceLifeMonths !== null) return Math.round(object.serviceLifeMonths / 12);
  return null;
}

export function serviceLifeEndsOn(
  manufacturedOn: string | null | undefined,
  serviceLifeYears: number | null | undefined,
): string | null {
  if (manufacturedOn == null || serviceLifeYears == null || !Number.isInteger(serviceLifeYears) || serviceLifeYears <= 0) return null;
  const [yearRaw, monthRaw, dayRaw] = manufacturedOn.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return null;
  const sourceLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > sourceLastDay) return null;

  // Для 29 февраля календарный год заканчивается в последний день февраля.
  const targetYear = year + serviceLifeYears;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

/**
 * Пропускает только адреса самого изготовителя.
 *
 * Адрес чужого магазина или агрегатора в карточке недопустим: по нему человек
 * сверяет заряд и ранг, и цена ошибки — неверно принятый огнетушитель.
 *
 * http допускается наравне с https. Это не небрежность: сайт Ярпожинвеста
 * работает только по http, и выбор здесь — либо ссылка на завод по http, либо
 * никакой ссылки вовсе. Страница читается, ничего не отправляется.
 */
function officialLink(url: string | null, manufacturer: ReferenceManufacturer): string | null {
  if (url === null || manufacturer.officialSite === '') return null;
  try {
    const link = new URL(url);
    const official = new URL(manufacturer.officialSite);
    if (link.protocol !== 'https:' && link.protocol !== 'http:') return null;
    const allowed = link.hostname === official.hostname
      || (manufacturer.documentHosts ?? []).includes(link.hostname);
    return allowed ? link.href : null;
  } catch {
    return null;
  }
}

/** «0,5» и «12» записаны как в обозначении; запятая здесь десятичная. */
function chargeOf(size: string): number | null {
  const value = Number(size.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function typeCodeForMark(type: string): string {
  if (type === 'ОП') return 'extinguisher-powder';
  if (type === 'ОУ') return 'extinguisher-co2';
  if (type === 'ОВП') return 'extinguisher-foam';
  if (type === 'ОВЭ') return 'extinguisher-bantl';
  if (type === 'ОВ') return 'extinguisher-water';
  return 'extinguisher';
}

function modelAppliesToType(modelTypeCode: string, selectedTypeCode: string): boolean {
  if (selectedTypeCode === 'extinguisher') return true;
  if (selectedTypeCode === 'extinguisher-emulsion') return modelTypeCode === 'extinguisher-bantl';
  return modelTypeCode === selectedTypeCode;
}
