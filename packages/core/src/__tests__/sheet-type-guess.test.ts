/**
 * Подсказка вида по названию раздела переносимого журнала (ТЗ, часть С103).
 *
 * Проверяется и то, что подсказка попадает, и то, что она молчит, когда
 * похожего нет: неверно подставленный вид уводит весь раздел журнала не туда,
 * и замечают это уже после переноса.
 */

import { describe, expect, it } from 'vitest';
import { guessTypeFromSheetName } from '../import/sheet-type-guess.js';

function guess(name: string): string | null {
  return guessTypeFromSheetName(name)?.typeCode ?? null;
}

describe('раздел узнаётся по названию', () => {
  it('названия заказчика', () => {
    expect(guess('Внутренний противопожарный водопровод')).toBe('fire-hydrant-indoor');
    expect(guess('Огнетушители')).toBe('extinguisher');
    expect(guess('Учёт огнетушителей по цеху')).toBe('extinguisher');
    expect(guess('Наружные пожарные лестницы')).toBe('outdoor-ladder');
    expect(guess('Ограждения кровли')).toBe('roof-fence');
    expect(guess('Пожарные гидранты')).toBe('hydrant');
    expect(guess('СОУЭ')).toBe('sounder');
    expect(guess('Система пожарной сигнализации')).toBe('control-panel');
    expect(guess('Огнезащитная обработка конструкций')).toBe('fireproofing');
  });

  it('регистр и падеж не мешают', () => {
    expect(guess('ОГНЕТУШИТЕЛИ')).toBe('extinguisher');
    expect(guess('Журнал учёта пожарных кранов')).toBe('fire-hydrant-indoor');
  });

  it('узкое название находится раньше общего', () => {
    // Иначе «внутренний противопожарный водопровод» ушёл бы в водоисточники.
    expect(guess('Внутренний противопожарный водопровод здания')).toBe('fire-hydrant-indoor');
  });

  it('непонятное название подсказки не даёт', () => {
    // Молчание честнее догадки: выбирает человек.
    expect(guess('Лист1')).toBeNull();
    expect(guess('Приложение № 3')).toBeNull();
    expect(guess('')).toBeNull();
  });

  it('говорит, по какому слову решила', () => {
    expect(guessTypeFromSheetName('Учёт огнетушителей')?.matched).toBe('огнетушител');
  });
});
