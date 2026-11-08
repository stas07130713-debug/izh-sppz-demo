/**
 * Состав таблицы журнала: одна настройка на семью видов.
 *
 * Заказчик: «возможность изменять состав таблицы относительно каждого
 * элемента». «Элемент» здесь — то, что человек видит разделом журнала: у
 * огнетушителей это огнетушители, а не восемь подвидов по отдельности.
 */

import { describe, expect, it } from 'vitest';
import {
  JOURNAL_PLACE, cardColumnKey, hiddenJournalColumns, journalColumnChoices,
  journalColumnShown, resetJournalColumns, toggleJournalColumn,
} from './journal-column-choice';

const empty = { journalColumns: {} };

describe('состав таблицы журнала', () => {
  it('по умолчанию показаны все графы', () => {
    expect(journalColumnShown(JOURNAL_PLACE, 'extinguisher-powder', empty)).toBe(true);
    expect(hiddenJournalColumns('extinguisher-powder', empty).size).toBe(0);
  });

  it('настройка семьи действует на все её подвиды', () => {
    const columns = toggleJournalColumn(empty, 'extinguisher-powder', JOURNAL_PLACE);
    const settings = { journalColumns: columns };

    // Убрали у порошкового — убралось у всей семьи: разделы журнала у них
    // разные, а настройка одна, как её и задавали.
    expect(journalColumnShown(JOURNAL_PLACE, 'extinguisher-co2', settings)).toBe(false);
    expect(journalColumnShown(JOURNAL_PLACE, 'extinguisher', settings)).toBe(false);
    // Чужой вид не задет.
    expect(journalColumnShown(JOURNAL_PLACE, 'hydrant', settings)).toBe(true);
  });

  it('графы карточки собираются по всей семье', () => {
    // У «огнетушителя без определённого типа» своей карточки нет, а у
    // порошкового есть: настраивают их вместе, значит и список общий.
    const titles = journalColumnChoices('extinguisher').map((choice) => choice.title);
    expect(titles).toContain('Данные карточки огнетушителя');
    expect(journalColumnChoices('extinguisher-powder').map((c) => c.key))
      .toContain(cardColumnKey('Данные карточки огнетушителя'));
  });

  it('возврат убирает запись целиком, а не оставляет пустую', () => {
    const hiddenOne = toggleJournalColumn(empty, 'extinguisher-powder', JOURNAL_PLACE);
    expect(Object.keys(hiddenOne)).toHaveLength(1);

    const back = resetJournalColumns({ journalColumns: hiddenOne }, 'extinguisher-co2');
    expect(Object.keys(back)).toHaveLength(0);
  });

  it('повторное переключение возвращает графу и стирает пустую запись', () => {
    const off = toggleJournalColumn(empty, 'hydrant', JOURNAL_PLACE);
    const on = toggleJournalColumn({ journalColumns: off }, 'hydrant', JOURNAL_PLACE);
    expect(Object.keys(on)).toHaveLength(0);
  });
});
