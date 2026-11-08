/**
 * Все подложки объекта с их масштабами — для раздела настроек.
 *
 * Отдельный сбор, а не расширение useNodePlan: там подложка одного узла, того,
 * с которым работают. Здесь нужен список целиком, чтобы было видно, у какого
 * этажа масштаб задан, а у какого нет, — иначе про забытый масштаб узнаёшь
 * только тогда, когда проверка отказывается строить круги.
 *
 * Показывается последняя подложка узла: план перезагружают, и прежние остаются
 * в хранилище как история. Масштаб прежних никого не интересует — работают с
 * последней.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TreeNode } from '@izh/contracts';
import { pathToNode } from '@izh/core';
import type { BackdropRow } from './components/BackdropSettings';

export interface BackdropScales {
  readonly rows: readonly BackdropRow[];
  readonly reload: () => Promise<void>;
}

export function useBackdropScales(nodes: readonly TreeNode[]): BackdropScales {
  const [rows, setRows] = useState<readonly BackdropRow[]>([]);

  const reload = useCallback(async (): Promise<void> => {
    const list = await window.izh.backdrops.list();
    if (!list.ok) { setRows([]); return; }

    const latest = new Map<string, (typeof list.value)[number]>();
    for (const item of list.value) {
      // Подложка без узла ни к какому плану не относится: показывать её
      // в списке этажей нечего.
      if (item.nodeId === null) continue;
      const known = latest.get(item.nodeId);
      if (known === undefined || known.createdAt.localeCompare(item.createdAt) < 0) latest.set(item.nodeId, item);
    }

    const collected: BackdropRow[] = [];
    for (const [nodeId, backdrop] of latest) {
      const calibration = await window.izh.backdrops.getCalibration(backdrop.id);
      collected.push({
        backdropId: backdrop.id,
        nodeId,
        nodeTitle: nodes.find((node) => node.id === nodeId)?.name ?? 'узел не найден',
        /*
         * Путь от организации, а не одно название узла.
         *
         * Заказчик: «когда выбираешь объект, например 1 этаж, непонятно, к
         * какому зданию он относится». Этажей с названием «1 этаж» на
         * предприятии столько же, сколько зданий, и одно название их не
         * различает — а масштаб задают не тому.
         */
        nodePath: pathToNode(nodes, nodeId).map((node) => node.name).join(' · '),
        widthPx: backdrop.widthPx,
        heightPx: backdrop.heightPx,
        metersPerPixel: calibration.ok ? calibration.value?.metersPerPixel ?? null : null,
      });
    }

    // Сортировка по пути, а не по названию: этажи одного здания идут подряд.
    collected.sort((a, b) => a.nodePath.localeCompare(b.nodePath, 'ru'));
    setRows(collected);
  }, [nodes]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, reload };
}
