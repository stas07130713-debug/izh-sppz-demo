/**
 * Копия таблички-указателя пожарного водоисточника (ТЗ, Дополнение 6).
 *
 * Сам знак — готовый F07 «Пожарный водоисточник» из набора значков программы,
 * тот же, каким водоисточник обозначен на плане. Рисовать его заново разметкой
 * не нужно и вредно: получилась бы вторая, чуть другая версия того же знака, а
 * на плане и на табличке он обязан выглядеть одинаково. Предыдущая попытка это
 * и подтвердила — дуга рукава, собранная из сегментов вручную, разъезжалась.
 *
 * Под знаком белая полоса, на которой пишут номер источника и объём воды.
 * Вписывать сюда нечего: и номер, и объём уже заданы в карточке. Табличка их
 * показывает, а не спрашивает второй раз — иначе на указателе и в журнале со
 * временем оказались бы разные числа.
 */

import { waterSourceNumberSign, waterSourceVolumeSign } from '@izh/core';
import type { WaterSourceProfile } from '@izh/contracts';
import signF07 from '../assets/element-icons/f07-water-source.svg';

export interface WaterSourceSignProps {
  readonly value: WaterSourceProfile;
  readonly regNumber: string | null;
}

export function WaterSourceSign(props: WaterSourceSignProps): React.JSX.Element {
  const number = waterSourceNumberSign(props.regNumber);
  const volume = waterSourceVolumeSign(props.value);

  return (
    <section className="water-sign-block">
      <h4>Копия таблички водоисточника</h4>

      <div className="water-sign">
        <img className="water-sign-picture" src={signF07} alt="Знак «Пожарный водоисточник»" />
        {/* Полоса показывается всегда, даже пустая: так видно, что на табличке
            есть место под номер и объём и их предстоит заполнить в карточке. */}
        <div className="water-sign-strip">
          <span>{number === '' ? 'ПВ — №' : number}</span>
          <span>{volume === '' ? 'V — м³' : volume}</span>
        </div>
      </div>

      <p className="muted small">
        Номер и объём берутся из карточки. При нескольких резервуарах объём подписывается общим —
        иначе расчёт примет его за объём одной ёмкости.
      </p>
    </section>
  );
}
