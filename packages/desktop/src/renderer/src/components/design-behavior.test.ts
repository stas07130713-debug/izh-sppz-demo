import { describe, expect, it } from 'vitest';
import { backdropGroups, type BackdropRow } from './BackdropSettings';
import { presentCondition } from './condition-presentation';
import { messageTone } from '../message-tone';

const backdrop = (id: string, title: string, path: string): BackdropRow => ({
  backdropId: id,
  nodeId: id,
  nodeTitle: title,
  nodePath: path,
  widthPx: 100,
  heightPx: 100,
  metersPerPixel: null,
});

describe('согласованное поведение интерфейса', () => {
  it('собирает этажи одного здания в один путь без повтора названия плана', () => {
    const groups = backdropGroups([
      backdrop('1', '1 этаж', 'Организация · Цех · Здание · 1 этаж'),
      backdrop('2', '2 этаж', 'Организация · Цех · Здание · 2 этаж'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.parents).toEqual(['Организация', 'Цех', 'Здание']);
    expect(groups[0]?.rows.map((row) => row.nodeTitle)).toEqual(['1 этаж', '2 этаж']);
  });

  it('показывает ровно одно итоговое состояние по худшему цвету', () => {
    expect(presentCondition({ schedule: 'норма', technical: 'исправен с замечаниями', color: 'warn' }))
      .toEqual({ color: 'warn', label: 'исправен с замечаниями' });
    expect(presentCondition({ schedule: 'нет данных', technical: 'не определено', color: 'unknown' }))
      .toEqual({ color: 'unknown', label: 'нет данных' });
  });

  it('не красит успешное сохранение как ошибку', () => {
    expect(messageTone('Сохранено — Журнал: C:\\journal.xlsx')).toBe('notice');
    expect(messageTone('Не удалось выгрузить журнал')).toBe('error');
  });
});
