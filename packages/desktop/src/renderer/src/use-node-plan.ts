/**
 * Подложка выбранного узла: генплан здания или поэтажный план этажа.
 *
 * Подложка принадлежит узлу дерева, а не общему списку файлов. Здесь она
 * подбирается по узлу вместе с очисткой и масштабом — всё, что нужно, чтобы
 * показать план и считать по нему площади.
 *
 * Три сведения выдаются **разом**, одним снимком, и в этом весь смысл модуля.
 *
 * Заказчик: «при переключении между зданиями и этажами происходит глюк: на
 * секунду проявляется другая подложка, а потом правильная». Причина была в
 * порядке загрузки. Сначала находился чертёж и показывался сразу, а очистка —
 * стёртые штампы, обрезка — приходила следующим запросом. В этот промежуток на
 * экране стоял исходный, неочищенный чертёж, да ещё и другого размера: значки
 * успевали разъехаться и тут же встать на место. Выглядело это как чужой план.
 *
 * Поэтому состояние здесь одно на все три сведения и меняется один раз: пока
 * снимок не собран целиком, показывать нечего. Пустое место — честнее чужого
 * чертежа.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CLEANUP_ENGINE_VERSION, type BackdropCleanup, type PlanBackdrop, type PlanCalibration } from '@izh/contracts';

export interface NodePlan {
  readonly backdrop: PlanBackdrop | null;
  readonly cleanup: BackdropCleanup | null;
  readonly calibration: PlanCalibration | null;
  /** Идёт переход на другой узел: в этот момент нельзя показывать заглушку другого плана. */
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
}

/** Собранный снимок плана: либо всё сразу, либо ничего. */
interface PlanSnapshot {
  /** Узел, для которого собран снимок. Не даёт показать прежний план даже один кадр. */
  readonly nodeId: string | null;
  readonly backdrop: PlanBackdrop | null;
  readonly cleanup: BackdropCleanup | null;
  readonly calibration: PlanCalibration | null;
}

const emptyPlan = (nodeId: string | null): PlanSnapshot => ({
  nodeId, backdrop: null, cleanup: null, calibration: null,
});

export function useNodePlan(nodeId: string | null): NodePlan {
  const [loaded, setLoaded] = useState<PlanSnapshot>(() => emptyPlan(nodeId));

  /**
   * Номер последней начатой загрузки.
   *
   * Пока читается план одного этажа, человек успевает щёлкнуть по другому.
   * Ответы приходят в том порядке, в каком успели, — и без этой отметки
   * запоздавший ответ первого этажа встал бы поверх второго. Тот же чужой
   * чертёж, только по другой причине.
   */
  const requestRef = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    requestRef.current += 1;
    const request = requestRef.current;
    const fresh = (): boolean => requestRef.current === request;

    if (nodeId === null) { setLoaded(emptyPlan(null)); return; }

    const list = await window.izh.backdrops.list();
    if (!list.ok || !fresh()) return;

    // Подложек у узла может быть несколько, если план перезагружали: берётся
    // последняя. История прежних остаётся в списке подложек.
    const found = list.value
      .filter((item) => item.nodeId === nodeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (found === undefined) { setLoaded(emptyPlan(nodeId)); return; }

    const [storedCleanup, storedCalibration] = await Promise.all([
      window.izh.backdrops.getCleanup(found.id),
      window.izh.backdrops.getCalibration(found.id),
    ]);
    if (!fresh()) return;

    /*
     * Очистка прежнего движка не берётся: она описана в понятиях, которых
     * теперешний движок не знает, и чертёж по ней собрался бы неверно.
     */
    const cleanup = storedCleanup.ok && storedCleanup.value?.engineVersion === CLEANUP_ENGINE_VERSION
      ? storedCleanup.value
      : null;

    setLoaded({
      nodeId,
      backdrop: found,
      cleanup,
      calibration: storedCalibration.ok ? storedCalibration.value : null,
    });
  }, [nodeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /*
   * Эффект запускается только после отрисовки. Поэтому очистка в эффекте всё
   * равно оставляла один кадр с планом прежнего этажа. Сверка ключа делается
   * прямо во время отрисовки: новый узел никогда не получает старый снимок.
   */
  const plan = loaded.nodeId === nodeId ? loaded : emptyPlan(nodeId);
  return {
    backdrop: plan.backdrop,
    cleanup: plan.cleanup,
    calibration: plan.calibration,
    loading: loaded.nodeId !== nodeId,
    reload,
  };
}
