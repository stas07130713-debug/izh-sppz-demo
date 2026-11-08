/**
 * Ссылки изготовителей в справочнике огнетушителей (ТЗ, Дополнение 6, часть С89).
 *
 * Проверяется не доступность адреса — сеть в тестах не трогаем, — а то, что
 * ссылка ведёт к самому изготовителю. Именно это и сломалось однажды: в
 * справочнике оказался угаданный адрес, и карточка предлагала «паспорт»,
 * которого по нему никогда не было.
 */

import { describe, expect, it } from 'vitest';
import reference from '../objects/fire_extinguisher_reference_v1.json';
import { extinguisherReferenceByManufacturerAndModel } from '../index.js';

interface Series {
  readonly type: string;
  readonly officialUrl?: string | null;
  readonly passportUrl?: string | null;
}
interface Manufacturer {
  readonly manufacturerName: string;
  readonly officialSite: string;
  readonly documentHosts?: readonly string[];
  readonly series: readonly Series[];
}

const MANUFACTURERS = (reference as { manufacturers: readonly Manufacturer[] }).manufacturers;

const hostsOf = (manufacturer: Manufacturer): readonly string[] => {
  if (manufacturer.officialSite === '') return [];
  return [new URL(manufacturer.officialSite).hostname, ...(manufacturer.documentHosts ?? [])];
};

describe('ссылки изготовителей', () => {
  it('каждая ссылка ведёт на сайт своего изготовителя', () => {
    const чужие: string[] = [];
    for (const manufacturer of MANUFACTURERS) {
      const hosts = hostsOf(manufacturer);
      for (const series of manufacturer.series) {
        for (const url of [series.officialUrl, series.passportUrl]) {
          if (url == null) continue;
          const host = new URL(url).hostname;
          if (!hosts.includes(host)) чужие.push(`${manufacturer.manufacturerName}: ${url}`);
        }
      }
    }
    expect(чужие).toEqual([]);
  });

  it('изготовитель без сайта не даёт ни одной ссылки', () => {
    // Ссылку «куда-нибудь» на такой случай не придумываем: магазин или
    // агрегатор — не изготовитель, и сверять по ним заряд и ранг нельзя.
    for (const manufacturer of MANUFACTURERS) {
      if (manufacturer.officialSite !== '') continue;
      for (const series of manufacturer.series) {
        expect(series.officialUrl ?? null).toBeNull();
        expect(series.passportUrl ?? null).toBeNull();
      }
    }
  });

  it('адреса разбираются и работают по http или https', () => {
    for (const manufacturer of MANUFACTURERS) {
      for (const series of manufacturer.series) {
        for (const url of [series.officialUrl, series.passportUrl]) {
          if (url == null) continue;
          expect(['http:', 'https:']).toContain(new URL(url).protocol);
        }
      }
    }
  });

  it('карточка BONTEL отдаёт и страницу изделия, и паспорт файлом', () => {
    const model = extinguisherReferenceByManufacturerAndModel('BONTEL', 'ОВЭ-2 BONTEL');
    expect(model?.officialUrl).toBe('https://bontel.ru/production/ognetushitel');
    expect(model?.passportUrl).toContain('.pdf');
  });

  it('у изготовителя с сайтом страница изделия есть', () => {
    const без: string[] = [];
    for (const manufacturer of MANUFACTURERS) {
      if (manufacturer.officialSite === '') continue;
      for (const series of manufacturer.series) {
        if (series.officialUrl == null) без.push(`${manufacturer.manufacturerName} ${series.type}`);
      }
    }
    expect(без).toEqual([]);
  });
});
