/**
 * Карточка выбранного узла дерева.
 *
 * Начинается карточка с шапки: значок вида, название узла крупно и путь от
 * организации мелко под ним. Раньше здесь стоял общий заголовок «Карточка
 * узла» и путь одной строкой — при переходе по дереву было не понять с
 * первого взгляда, чью карточку правишь, а ошибка стоит дорого: названия
 * попадают в печатный план и в журнал.
 *
 * Путь показан и здесь: именно он идёт в штамп печатного плана, и человек
 * видит его там же, где правит названия.
 *
 * Для здания под общими полями открывается карточка характеристик в части
 * пожарной безопасности — они нужны нормативному движку и дашборду состояния.
 */

import { useEffect, useState } from 'react';
import type { BuildingProfile, Room, TreeNode } from '@izh/contracts';
import { missingProfileFields, ruleFor } from '@izh/core';
import { BuildingProfileForm } from './BuildingProfileForm';
import { RoomsPanel, type NewRoom } from './RoomsPanel';
import type { RoomHazardPatch } from './RoomHazardFields';

export interface NodeFields {
  readonly name: string;
  readonly code: string | null;
  readonly elevationM: number | null;
  readonly building: BuildingProfile | null;
}

export interface NodeCardProps {
  readonly node: TreeNode;
  readonly caption: string;
  readonly busy: boolean;
  /** Помещения этажа. Для остальных узлов пустой список. */
  readonly rooms: readonly Room[];
  readonly hasPlan: boolean;
  readonly hasScale: boolean;
  readonly drawingRoomId: string | null;
  readonly onAddRoom: (room: NewRoom) => void;
  readonly onDrawRoom: (roomId: string) => void;
  /** Перейти на план и подсветить обводку помещения. */
  readonly onShowRoomOnPlan: (roomId: string) => void;
  readonly onClearRoomOutline: (roomId: string) => void;
  /** Сколько точек уже поставлено: по ним видно, есть ли что замыкать. */
  readonly outlinePointCount: number;
  readonly onFinishOutline: () => void;
  readonly onCancelOutline: () => void;
  readonly hoveredRoomId: string | null;
  readonly onHoverRoom: (roomId: string | null) => void;
  readonly onArchiveRoom: (roomId: string) => void;
  /** Правка сведений помещения, от которых зависит норма по огнетушителям. */
  readonly onChangeRoomHazard: (roomId: string, patch: RoomHazardPatch) => void;
  /** Помещение, к которому прислала проверка: его сведения раскрыты сразу. */
  readonly hazardRoomId: string | null;
  readonly onSave: (fields: NodeFields) => void;
  readonly onToggleJournal: (include: boolean) => void;
}

/**
 * Значок вида узла.
 *
 * Буквой, а не картинкой: видов пять, они не меняются, и рисовать ради них
 * пять файлов незачем. Цвет тот же, что у ветки дерева слева, — так карточка
 * и дерево читаются как одно целое.
 */
const KIND_MARK: Readonly<Record<string, { readonly mark: string; readonly color: string }>> = {
  organization: { mark: 'О', color: '#7c3aed' },
  shop: { mark: 'Ц', color: '#0891b2' },
  building: { mark: 'З', color: '#2563eb' },
  level: { mark: 'Э', color: '#059669' },
  storage: { mark: 'С', color: '#b45309' },
};

export function NodeCard(props: NodeCardProps): React.JSX.Element {
  const { node } = props;
  const rule = ruleFor(node.kind);
  const archived = node.archivedAt !== null;

  const [name, setName] = useState(node.name);
  const [code, setCode] = useState(node.code ?? '');
  const [elevation, setElevation] = useState(node.elevationM === null ? '' : String(node.elevationM));
  const [profile, setProfile] = useState<BuildingProfile | null>(node.building);

  // При выборе другого узла форма заполняется заново. Зависимость по id и по
  // самим значениям: иначе поля затирались бы при каждом обновлении дерева.
  useEffect(() => {
    setName(node.name);
    setCode(node.code ?? '');
    setElevation(node.elevationM === null ? '' : String(node.elevationM));
    setProfile(node.building);
  }, [node.id, node.name, node.code, node.elevationM, node.building]);

  const parsedElevation = elevation.trim() === '' ? null : Number(elevation.replace(',', '.'));
  const elevationLooksWrong = parsedElevation !== null && !Number.isFinite(parsedElevation);

  const changed =
    name !== node.name ||
    code !== (node.code ?? '') ||
    parsedElevation !== node.elevationM ||
    JSON.stringify(profile) !== JSON.stringify(node.building);

  const missing = rule.hasBuildingProfile ? missingProfileFields(node.building) : [];

  return (
    <div className="node-card">
      {/*
        * Шапка отвечает на вопрос «чью карточку я правлю» до того, как его
        * успеешь задать: значок вида, название крупно, путь от организации
        * мелко под ним.
        */}
      <header className="node-card-head">
        <span
          className="node-card-mark"
          style={{ background: KIND_MARK[node.kind]?.color ?? 'var(--accent)' }}
          aria-hidden="true"
        >
          {KIND_MARK[node.kind]?.mark ?? '?'}
        </span>
        <div className="node-card-titles">
          <div className="node-card-name">{node.name}</div>
          <div className="node-card-kind">{rule.title}</div>
        </div>
        {archived && <span className="badge muted">выведен из эксплуатации</span>}
      </header>

      {/*
        * Прокручивается только содержимое: шапка отвечает «чью карточку правлю»,
        * полоса сохранения — «сохранено ли», и обе нужны на любой прокрутке.
        */}
      <div className="node-card-body">
      <p className="node-card-path" title="Эта строка попадёт в штамп печатного плана">
        {props.caption}
      </p>

      <section className="node-card-block">
      <h4>Общие сведения</h4>
      <label className="field">
        <span>{node.kind === 'organization' ? 'Наименование' : 'Название'}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={archived}
          /* Запрет объясняется прямо: молчащее поле читается как поломка. */
          title={archived ? 'Узел выведен из эксплуатации: сведения не правятся' : undefined}
          placeholder={node.kind === 'level' ? 'Первый этаж или отметка +4.200' : undefined}
        />
      </label>

      {(node.kind === 'shop' || node.kind === 'building' || node.kind === 'storage') && (
        <label className="field">
          <span>{node.kind === 'building' ? 'Инвентарный номер' : 'Код или номер'}</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={archived}
            title={archived ? 'Узел выведен из эксплуатации: сведения не правятся' : undefined}
          />
        </label>
      )}

      {/*
        * Отметка уровня. Поле спрашивается по правилу вида узла
        * (`hasElevation`), а не по названию: правило и решает, у кого отметка
        * бывает.
        *
        * Раньше её негде было набрать: значение сохранялось и показывалось в
        * дереве, но поля в карточке не было вовсе, и заданную при создании
        * отметку нельзя было исправить.
        */}
      {rule.hasElevation && (
        <label className="field">
          <span>Отметка уровня, м</span>
          <input
            value={elevation}
            onChange={(event) => setElevation(event.target.value)}
            disabled={archived}
            inputMode="decimal"
            placeholder="0, 4.2, −3.6"
            title={archived ? 'Узел выведен из эксплуатации: сведения не правятся' : undefined}
          />
        </label>
      )}

      {elevationLooksWrong && <p className="small error">Отметка должна быть числом: 0, 4.2, −3.6.</p>}
      </section>

      {rule.hasBuildingProfile && (
        <section className="node-card-block">
          <h4>Характеристики по пожарной безопасности</h4>
          {missing.length > 0 && (
            <p className="small warn">Не заполнено характеристик: {missing.length}. Они нужны для выводов по нормам.</p>
          )}
          <BuildingProfileForm profile={profile} disabled={archived} onChange={setProfile} />
        </section>
      )}

      {node.kind === 'level' && !archived && (
        <section className="node-card-block">
        <RoomsPanel
          rooms={props.rooms}
          busy={props.busy}
          hasPlan={props.hasPlan}
          hasScale={props.hasScale}
          drawingRoomId={props.drawingRoomId}
          onAdd={props.onAddRoom}
          onDraw={props.onDrawRoom}
          onShowOnPlan={props.onShowRoomOnPlan}
          onClearOutline={props.onClearRoomOutline}
          outlinePointCount={props.outlinePointCount}
          onFinishOutline={props.onFinishOutline}
          onCancelOutline={props.onCancelOutline}
          hoveredRoomId={props.hoveredRoomId}
          onHoverRoom={props.onHoverRoom}
          onArchive={props.onArchiveRoom}
          onChangeHazard={props.onChangeRoomHazard}
          hazardRoomId={props.hazardRoomId}
        />
        </section>
      )}

      {(node.kind === 'level' || node.kind === 'storage') && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={node.inCommonJournal}
            disabled={props.busy || archived}
            onChange={(event) => props.onToggleJournal(event.target.checked)}
          />
          <span className="small">Показывать в общем журнале здания</span>
        </label>
      )}
      </div>

      {/*
        * Полоса сохранения — подвал карточки, вне прокручиваемого тела.
        *
        * Она стояла посреди карточки: у этажа под ней шли ещё помещения и
        * общий журнал, и кнопка «Сохранить» читалась как относящаяся к ним.
        * Теперь кнопка стоит там же, где во всех окнах программы, — внизу
        * справа, и видна при любой прокрутке.
        */}
      <div className="node-card-save">
        <span className="muted small">
          {archived ? 'Узел выведен из эксплуатации: правки закрыты'
            : changed ? 'Есть несохранённые изменения' : 'Всё сохранено'}
        </span>
        <button
          type="button"
          className="primary"
          disabled={props.busy || !changed || elevationLooksWrong || archived}
          onClick={() =>
            props.onSave({
              name,
              code: code.trim() === '' ? null : code,
              elevationM: parsedElevation,
              building: rule.hasBuildingProfile ? profile : null,
            })
          }
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
