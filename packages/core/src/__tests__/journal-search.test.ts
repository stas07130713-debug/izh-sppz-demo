/**
 * Поиск по журналу (требование заказчика на доработку, пункт 5).
 *
 * Заказчик: «вводишь "извещатель пожарный", а записи не находятся». Искали по
 * учётному номеру, марке и месту — наименования вида в поиске не было вовсе.
 */

import { describe, expect, it } from 'vitest';
import { journalSearchText, matchesSearch } from '../rules/journal-search.js';

const detector = journalSearchText({
  name: 'Извещатель пожарный',
  kind: 'Извещатель пожарный',
  regNumber: 'ИП-12',
  model: 'ИП 212-45',
  place: 'Коридор 2 этажа',
  responsible: 'Иванов И. И.',
  technicalState: 'исправен',
  note: null,
});

describe('поиск по журналу', () => {
  it('находит по наименованию вида — то, ради чего всё и делалось', () => {
    expect(matchesSearch(detector, 'извещатель пожарный')).toBe(true);
  });

  it('находит по началу слова', () => {
    expect(matchesSearch(detector, 'извещ')).toBe(true);
  });

  it('слова в любом порядке и незаконченные', () => {
    // Заказчик привёл этот пример прямо: «пожарн изв».
    expect(matchesSearch(detector, 'пожарн изв')).toBe(true);
  });

  it('регистр не важен', () => {
    expect(matchesSearch(detector, 'ИЗВЕЩАТЕЛЬ')).toBe(matchesSearch(detector, 'извещатель'));
    expect(matchesSearch(detector, 'ИЗВЕЩАТЕЛЬ')).toBe(true);
  });

  it('«ё» и «е» — одна буква', () => {
    const hose = journalSearchText({
      name: 'Пожарный рукав', kind: 'Пожарный кран', regNumber: 'ПК-1',
      model: null, place: 'Лестничная клетка', responsible: null,
      technicalState: null, note: 'Перекатка на новое ребро',
    });
    expect(matchesSearch(hose, 'ребро')).toBe(true);
    expect(matchesSearch(hose, 'рёбро')).toBe(true);
  });

  it('находит по номеру, марке, месту и ответственному', () => {
    expect(matchesSearch(detector, 'ИП-12')).toBe(true);
    expect(matchesSearch(detector, '212-45')).toBe(true);
    expect(matchesSearch(detector, 'коридор')).toBe(true);
    expect(matchesSearch(detector, 'иванов')).toBe(true);
  });

  it('чужое слово не находит', () => {
    expect(matchesSearch(detector, 'огнетушитель')).toBe(false);
    // Все слова обязаны найтись: одно совпавшее из двух — не совпадение.
    expect(matchesSearch(detector, 'извещатель огнетушитель')).toBe(false);
  });

  it('пустой запрос подходит всему: отбор не задан', () => {
    expect(matchesSearch(detector, '')).toBe(true);
    expect(matchesSearch(detector, '   ')).toBe(true);
  });

  it('пустые части не склеиваются в ложное совпадение', () => {
    const bare = journalSearchText({
      name: 'Огнетушитель', kind: 'Огнетушитель', regNumber: null, model: null,
      place: null, responsible: null, technicalState: null, note: null,
    });
    expect(bare).toBe('Огнетушитель Огнетушитель');
    expect(matchesSearch(bare, 'огнетушитель коридор')).toBe(false);
  });
});
