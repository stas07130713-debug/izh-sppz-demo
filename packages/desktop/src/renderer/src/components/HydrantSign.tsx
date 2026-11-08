/**
 * Копия таблички-указателя пожарного гидранта (ТЗ, Дополнение 6).
 *
 * Табличка нарисована так же, как продаётся бланк: все заполняемые места
 * обведены пунктиром и видны сразу, даже пока пустые. Прятать незаполненное
 * нельзя — тогда табличка выглядит готовой, хотя на ней нет ни образца, ни
 * сети, ни номера, и человек не догадывается, что их вообще нужно вносить.
 *
 * Образец, сеть и номер подставляются из карточки: они там уже заданы, и
 * набирать их второй раз человек не должен. Расстояния он вводит прямо здесь,
 * по каждой стрелке отдельно — их меряют рулеткой от указателя до крышки
 * колодца, и знает их только тот, кто там стоял.
 */

import { formatSignDistance, hydrantPatternSign, waterNetworkSign } from '@izh/core';
import type { OutdoorHydrantProfile } from '@izh/contracts';

export interface HydrantSignProps {
  readonly value: OutdoorHydrantProfile;
  readonly regNumber: string | null;
  readonly busy: boolean;
  readonly onChange: (value: OutdoorHydrantProfile) => void;
}

type DistanceField = 'signDistanceLeftM' | 'signDistanceRightM' | 'signDistanceDownM';

/**
 * Заполняемое место таблички: пунктирная рамка и надпись поверх неё.
 *
 * Надпись длиннее своего места поджимается по ширине, а не набирается мельче:
 * размер букв на табличке один для всех надписей, и «КТ-1000» уменьшенным
 * шрифтом читалось бы как надпись другого рода. Так же поступают и с краской —
 * буквы пишут уже, а не ниже.
 */
function Slot(props: {
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly text: string; readonly title: string;
  /** Сколько знаков помещается без поджатия. */
  readonly fits: number;
}): React.JSX.Element {
  const tight = props.text.length > props.fits;

  return (
    <g>
      <title>{props.title}</title>
      <rect className="sign-slot" x={props.x} y={props.y} width={props.w} height={props.h} rx="1" />
      {props.text !== '' && (
        <text
          className="sign-small"
          x={props.x + props.w / 2}
          y={props.y + props.h * 0.78}
          textAnchor="middle"
          textLength={tight ? props.w - 2 : undefined}
          lengthAdjust={tight ? 'spacingAndGlyphs' : undefined}
        >
          {props.text}
        </text>
      )}
    </g>
  );
}

export function HydrantSign(props: HydrantSignProps): React.JSX.Element {
  const pattern = hydrantPatternSign(props.value.pattern);
  const network = waterNetworkSign(props.value);
  const number = props.regNumber === null || props.regNumber.trim() === '' ? '' : props.regNumber;

  /** Приводит введённое к виду таблички: «12» и «12,0» становятся «12.0». */
  const normalize = (field: DistanceField) => (): void => {
    const formatted = formatSignDistance(props.value[field]);
    if (formatted !== props.value[field]) {
      props.onChange({ ...props.value, [field]: formatted === '' ? null : formatted });
    }
  };

  const distance = (field: DistanceField, className: string, title: string): React.JSX.Element => (
    <input
      className={`sign-input ${className}`}
      inputMode="decimal"
      placeholder="00.0"
      title={title}
      value={props.value[field] ?? ''}
      onChange={(event) => props.onChange({ ...props.value, [field]: event.target.value })}
      onBlur={normalize(field)}
    />
  );

  return (
    <section className="hydrant-sign-block">
      <h4>Копия таблички ПГ</h4>

      <div className="hydrant-sign">
        <svg viewBox="0 0 100 100">
          <rect x="0" y="0" width="100" height="100" fill="#dc2626" />
          <rect x="6" y="6" width="88" height="88" fill="#fff" />

          {/* Верхний ряд: образец слева, водопроводная сеть справа. */}
          <Slot x={7} y={7} w={26} h={14} text={pattern} fits={3} title="Образец гидранта" />
          <Slot x={60} y={7} w={33} h={14} text={network} fits={6} title="Водопроводная сеть" />

          <text className="sign-big" x="50" y="47" textAnchor="middle">ПГ</text>
          {/* Дефис между «ПГ» и номером: на табличке это одно обозначение
              гидранта, а не две отдельные надписи рядом. */}
          <path d="M66 43 h4" className="sign-dash" />
          <Slot x={72} y={35} w={19} h={14} text={number} fits={4} title="Учётный номер гидранта" />

          {/* Три стрелки, как на бланке: влево, вправо и вперёд к гидранту.
              У каждой своё расстояние — одно число на двустороннюю стрелку не
              говорит, в какую сторону идти. */}
          <path d="M20 70 h60" className="sign-line" />
          <path d="M13 70 l7 -5 v10 z" className="sign-arrow" />
          <path d="M87 70 l-7 -5 v10 z" className="sign-arrow" />
          <path d="M50 70 v16" className="sign-line" />
          <path d="M50 92 l-5 -7 h10 z" className="sign-arrow" />
        </svg>

        {/* Расстояние вперёд — над стрелками, по образцу бланка; расстояния
            влево и вправо — по бокам, под своими стрелками. */}
        {distance('signDistanceDownM', 'sign-input-ahead', 'Расстояние вперёд, к гидранту, метров')}
        {distance('signDistanceLeftM', 'sign-input-left', 'Расстояние влево, метров')}
        {distance('signDistanceRightM', 'sign-input-right', 'Расстояние вправо, метров')}
      </div>

      <p className="muted small">
        Образец, сеть и номер подставляются из карточки. Расстояния измеряются по месту и вводятся
        прямо в табличке: сверху — вперёд, по бокам — влево и вправо; ненужные остаются пустыми.
      </p>
    </section>
  );
}
