/**
 * Категория, записанная фразой (ТЗ, Дополнение 6, часть С91).
 *
 * В поле категории пишут не только «В2»: встречаются «не категорируется»,
 * «н/к», прочерк. Для расчёта это одно и то же — категории нет. Раньше такая
 * запись шла в расчёт как категория и попадала в окно проверки прописными:
 * «строка «Г, Д» таблицы 1 (категория помещения НЕКАТЕГОРИРУЕТСЯ)».
 */

import { describe, expect, it } from 'vitest';
import { normalizeCategory, roomRequirement } from '../index.js';

describe('разбор категории', () => {
  it('настоящая категория читается, как её ни запиши', () => {
    expect(normalizeCategory('В-2')).toBe('В2');
    expect(normalizeCategory('в2')).toBe('В2');
    expect(normalizeCategory(' Д ')).toBe('Д');
  });

  it('фраза вместо категории — это отсутствие категории', () => {
    expect(normalizeCategory('не категорируется')).toBe('');
    expect(normalizeCategory('н/к')).toBe('');
    expect(normalizeCategory('—')).toBe('');
    expect(normalizeCategory('')).toBe('');
    expect(normalizeCategory(null)).toBe('');
  });

  it('несуществующей категории «Е» тоже нет', () => {
    // Список категорий закрыт СП 12.13130: А, Б, В1–В4, Г, Д.
    expect(normalizeCategory('Е')).toBe('');
  });
});

describe('обоснование строки таблицы', () => {
  const basis = (category: string): string => roomRequirement({
    category, purpose: 'общественное', areaM2: 1800, fireClasses: ['A'], hasSuppression: false,
  }).rowBasis;

  it('фраза не выдаётся за категорию', () => {
    expect(basis('не категорируется')).not.toContain('НЕКАТЕГОРИРУЕТСЯ');
  });

  it('для общественного помещения названа настоящая причина', () => {
    // Общественные помещения по взрывопожарной опасности не категорируют — так
    // это и должно быть написано, а не «категория помещения <фраза>».
    expect(basis('не категорируется')).toContain('не категорируется');
    expect(basis('не категорируется')).toContain('пункту 409');
  });

  it('настоящая категория по-прежнему называется', () => {
    expect(basis('В2')).toContain('категория помещения В2');
  });
});
