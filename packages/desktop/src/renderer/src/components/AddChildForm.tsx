/**
 * Форма «добавить внутрь выбранного узла».
 *
 * Перечень доступных видов берётся из ядра: интерфейс не решает сам, что во что
 * вкладывается, а показывает то, что разрешают правила. Поэтому невозможного
 * действия здесь просто нет в списке.
 *
 * Вид можно задать снаружи (`fixedKind`). Так форма открывается из меню узла,
 * где вид уже назван пунктом: «добавить этаж» и следом выбор вида в форме — это
 * один и тот же вопрос, заданный дважды.
 *
 * Характеристики здания в этой форме не запрашиваются: здание заводится одним
 * названием, а карточка характеристик открывается сразу после создания, под
 * деревом. Так пользователь не упирается в двадцать полей, чтобы завести узел.
 */

import { useState } from 'react';
import type { NodeKind, TreeNode } from '@izh/contracts';
import { allowedChildKinds, ruleFor } from '@izh/core';
import { SelectField } from './SelectField';

export interface NewChild {
  readonly kind: NodeKind;
  readonly name: string;
  readonly code: string | null;
  readonly elevationM: number | null;
}

export interface AddChildFormProps {
  readonly parent: TreeNode;
  /** Вид уже выбран снаружи — форма о нём не спрашивает. */
  readonly fixedKind?: NodeKind;
  readonly busy: boolean;
  readonly onAdd: (child: NewChild) => void;
}

export function AddChildForm(props: AddChildFormProps): React.JSX.Element {
  const kinds = allowedChildKinds(props.parent.kind);
  const [kind, setKind] = useState<NodeKind>(kinds[0] ?? 'building');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [elevation, setElevation] = useState('');

  if (kinds.length === 0) {
    return (
      <p className="muted small">
        Внутрь этого узла узлы дерева не заводятся — здесь работает уже само оборудование.
      </p>
    );
  }

  // Выбранный вид мог остаться от другого узла: при переключении узла список
  // видов меняется, а состояние формы живёт дальше.
  const chosen = kinds.includes(kind) ? kind : (kinds[0] ?? 'building');
  const current = props.fixedKind ?? chosen;
  const rule = ruleFor(current);

  const submit = (): void => {
    props.onAdd({
      kind: current,
      name,
      code: code.trim() === '' ? null : code,
      elevationM: rule.hasElevation && elevation.trim() !== '' ? Number(elevation.replace(',', '.')) : null,
    });
    setName('');
    setCode('');
    setElevation('');
  };

  const elevationLooksWrong =
    rule.hasElevation && elevation.trim() !== '' && !Number.isFinite(Number(elevation.replace(',', '.')));

  return (
    <div className="add-child">
      <h4>
        {props.fixedKind === undefined
          ? `Добавить внутрь: ${props.parent.name}`
          : `${rule.title} внутрь: ${props.parent.name}`}
      </h4>

      {props.fixedKind === undefined && (
        <label className="field">
          <span>Что добавляем</span>
          <SelectField
            value={current}
            options={kinds.map((item) => ({ value: item, title: ruleFor(item).title }))}
            onChange={(value) => setKind(value as NodeKind)}
          />
        </label>
      )}
      <p className="muted small">{rule.hint}</p>

      <label className="field">
        <span>Название</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={namePlaceholder(current)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>{current === 'building' ? 'Инвентарный номер' : 'Код или номер'}</span>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="необязательно" />
        </label>

        {rule.hasElevation && (
          <label className="field">
            <span>Отметка, м</span>
            <input value={elevation} onChange={(event) => setElevation(event.target.value)} placeholder="0.000" />
          </label>
        )}
      </div>

      {elevationLooksWrong && <p className="small error">Отметка должна быть числом: 0, 4.2, −3.6.</p>}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={props.busy || name.trim() === '' || elevationLooksWrong}
          onClick={submit}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function namePlaceholder(kind: NodeKind): string {
  if (kind === 'shop') return 'Например: МВАСО';
  if (kind === 'building') return 'Например: Учебная башня';
  if (kind === 'level') return 'Например: 2 этаж';
  if (kind === 'storage') return 'Например: Запас огнетушителей или АЦ 4.0-60';
  return 'Название';
}
