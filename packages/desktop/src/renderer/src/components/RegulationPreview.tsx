/**
 * «Просмотреть итоговый регламент» (ТЗ, Дополнение 5, часть Р13).
 *
 * Показывает то, что получится после выпуска версии: какие работы, с какой
 * периодичностью и на каком основании. Читается как документ, а не как форма
 * настройки, — это то, что предъявляют проверяющему и по чему работает
 * исполнитель.
 *
 * Отключённые работы показаны отдельно и зачёркнуты: важно видеть не только
 * что делается, но и от чего организация отказалась и почему это было можно.
 */

import type { RegulationPeriodicity } from '@izh/contracts';
import { backdropClose } from './modal-backdrop';
import { describePeriodicity } from './periodicity-text';

export interface RegulationPreviewProps {
  readonly typeTitle: string;
  readonly periodicities: readonly RegulationPeriodicity[];
  readonly onClose: () => void;
}

export function RegulationPreview(props: RegulationPreviewProps): React.JSX.Element {
  const used = props.periodicities.filter((item) => item.enabled);

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Итоговый регламент — {props.typeTitle}</h3>
          <button type="button" className="link" onClick={props.onClose}>закрыть ✕</button>
        </div>

        {used.length === 0 ? (
          <p className="muted small">Ни одна периодичность не включена: работ по этому виду не назначено.</p>
        ) : (
          used.map((periodicity) => {
            const active = periodicity.activities.filter((activity) => activity.required);
            const skipped = periodicity.activities.filter((activity) => !activity.required);

            return (
              <section key={periodicity.id} className="preview-block">
                <h4>
                  {periodicity.title}
                  <span className="muted small"> — {describePeriodicity(periodicity.rule)}</span>
                </h4>

                {active.length === 0 ? (
                  <p className="muted small">Состав работ не выбран.</p>
                ) : (
                  <ol className="preview-list">
                    {active.map((activity) => (
                      <li key={activity.id}>
                        {activity.title}
                        {activity.unit !== null && <span className="muted small"> ({activity.unit})</span>}
                        <div className="muted small">
                          {activity.sources.map((source) => source.reference).join('; ')}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {skipped.length > 0 && (
                  <details className="preview-skipped">
                    <summary className="muted small">Не выполняется: {skipped.length}</summary>
                    <ul className="preview-list muted small">
                      {skipped.map((activity) => (
                        <li key={activity.id}><s>{activity.title}</s></li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })
        )}

        <p className="muted small">
          Это предварительный вид. Регламент начнёт действовать после выпуска новой версии, и с этого
          момента чек-листы будут собираться по нему.
        </p>
      </div>
    </div>
  );
}
