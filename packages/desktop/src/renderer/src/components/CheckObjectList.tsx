/**
 * Огнетушители помещения в окне проверки — по строке на каждый.
 *
 * Раньше их было видно дважды: сверху перечень выводов, где у каждого стоял
 * номер огнетушителя, и следом список самих огнетушителей с тем же номером и
 * той же причиной. Одно и то же читалось два раза подряд и расходилось в
 * словах: в перечне «не указан заряд ОТВ», в списке «ранг в карточке не
 * заполнен».
 *
 * Теперь про огнетушитель написано в одном месте — в его строке: марка, номер,
 * исполнение, вывод, вычисленный ранг и, если есть, что с ним не так. Сверху
 * остаются только выводы про само помещение: площадь, классы, число
 * огнетушителей, расстояние.
 *
 * Строка — кнопка целиком: щёлкают по ней, а не целятся в номер. Открывается
 * карточка, где недостающее и заполняется.
 */

import type { PlanObject } from '@izh/contracts';
import type { ExtinguisherFitness, PlacementFinding } from '@izh/core';
import { SEVERITY_CLASS } from './check-severity';

export interface CheckObjectItem {
  readonly object: PlanObject;
  readonly fitness: ExtinguisherFitness;
}

export interface CheckObjectListProps {
  readonly items: readonly CheckObjectItem[];
  /** Все выводы помещения: относящиеся к объектам раскладываются по строкам. */
  readonly findings: readonly PlacementFinding[];
  readonly onShowObject: (object: PlanObject) => void;
}

const VERDICT_BADGE: Readonly<Record<string, string>> = {
  подходит: 'ok',
  'не подходит': 'danger',
  'нет сведений': 'warn',
};

/**
 * Ранг и откуда он взят.
 *
 * Показывается всегда, даже когда его нет: «ранг не определён» — это и есть
 * ответ на вопрос, почему огнетушитель не засчитан.
 */
function rankOf(fitness: ExtinguisherFitness): string {
  if (fitness.rankText === '') return 'ранг не определён';
  return `${fitness.rankText} — ${fitness.basis}`;
}

export function CheckObjectList(props: CheckObjectListProps): React.JSX.Element | null {
  if (props.items.length === 0) return null;

  return (
    <ul className="check-objects">
      {props.items.map((item) => {
        const own = props.findings.filter((finding) => finding.objectId === item.object.id);
        return (
          <li key={item.object.id}>
            <button
              type="button"
              className="check-object-row"
              title="Открыть карточку огнетушителя"
              onClick={() => props.onShowObject(item.object)}
            >
              <span className="check-object-mark">{item.fitness.mark}</span>
              <span className="check-object-number">№ {item.object.regNumber ?? 'без номера'}</span>
              <span className="muted small">{item.fitness.execution}</span>
              <span className={`badge ${VERDICT_BADGE[item.fitness.verdict] ?? 'warn'}`}>
                {item.fitness.verdict}
              </span>
              <span className="muted small">{rankOf(item.fitness)}</span>
            </button>

            {own.length > 0 && (
              <ul className="check-object-findings">
                {own.map((finding, index) => (
                  <li key={`${finding.text}-${index}`} className={SEVERITY_CLASS[finding.severity]}>
                    <span className="check-severity">{finding.severity}</span>
                    <span>{finding.text}</span>
                    <span className="muted small">{finding.clause}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
