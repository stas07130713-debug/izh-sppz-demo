/**
 * Характеристика объекта защиты для расчёта огнетушителей.
 *
 * Заказчик: «для расчёта проверки огнетушителей не нужно категорирование всех
 * помещений, достаточно категорию и функциональное назначение самого здания».
 *
 * Здесь эти сведения и задаются — прямо в окне проверки, рядом с выводом, где о
 * их нехватке и сказано. Отправлять человека в карточку здания через дерево
 * ради четырёх полей значило бы оставить его искать, куда идти.
 *
 * Площадь вводится числом, а не считается по обводке. Обводка и масштаб нужны
 * для расстояний — это уточнение; чтобы узнать, сколько и какого ранга
 * огнетушителей требуется, довольно площади из технического паспорта.
 *
 * Назначение отдельным полем не спрашивается: оно выводится из класса
 * функциональной пожарной опасности. Ф5.1 — это и есть «производственное», и
 * заставлять повторять уже написанное незачем.
 */

import type { BuildingProfile } from '@izh/contracts';
import {
  FUNCTIONAL_CLASSES, ROOM_CATEGORIES, functionalClassLabel, purposeOfFunctionalClasses,
} from '@izh/core';
import { SelectField } from './SelectField';


const FIRE_CLASSES: readonly string[] = ['A', 'B', 'C', 'D', 'E'];

export interface BuildingHazardFieldsProps {
  readonly buildingName: string;
  readonly profile: BuildingProfile;
  readonly busy: boolean;
  readonly onChange: (profile: BuildingProfile) => void;
}

/** Многозначные поля профиля хранятся строкой через запятую. */
function listOf(raw: string | null): readonly string[] {
  return raw === null || raw.trim() === '' ? [] : raw.split(',').map((item) => item.trim());
}

export function BuildingHazardFields(props: BuildingHazardFieldsProps): React.JSX.Element {
  const purpose = purposeOfFunctionalClasses(props.profile.functionalClasses);

  const set = <K extends keyof BuildingProfile>(key: K, value: BuildingProfile[K]): void =>
    props.onChange({ ...props.profile, [key]: value });

  /** Отметка в многозначном поле: порядок хранится справочный, а не порядок нажатий. */
  const toggle = (key: 'functionalClasses' | 'fireClasses', options: readonly string[], item: string): void => {
    const chosen = listOf(props.profile[key]);
    const next = chosen.includes(item) ? chosen.filter((value) => value !== item) : [...chosen, item];
    const ordered = options.filter((option) => next.includes(option));
    set(key, ordered.length === 0 ? null : ordered.join(', '));
  };

  return (
    <section className="check-building">
      <h4>Характеристика объекта: {props.buildingName}</h4>
      <p className="muted small">
        По этим сведениям считается норма, пока помещения не заведены. Заведёте и обведёте
        помещения — проверка станет точнее и добавит расстояния до огнетушителей.
      </p>

      <div className="field-row">
        <label className="field">
          <span>Категория по взрывопожарной опасности</span>
          <SelectField
            value={props.profile.explosionCategory ?? ''}
            placeholder="не задана"
            disabled={props.busy}
            options={ROOM_CATEGORIES.map((item) => ({ value: item, title: item }))}
            onChange={(value) => set('explosionCategory', value === '' ? null : value)}
          />
        </label>

        <label className="field">
          <span>Площадь, м²</span>
          <input
            inputMode="decimal"
            value={props.profile.builtAreaM2 ?? ''}
            placeholder="3994.2"
            onChange={(event) => {
              const parsed = Number(event.target.value.replace(',', '.'));
              const empty = event.target.value.trim() === '' || !Number.isFinite(parsed);
              set('builtAreaM2', empty ? null : parsed);
            }}
          />
        </label>
      </div>

      <div className="field">
        <span>Классы функциональной пожарной опасности</span>
        <div className="fire-classes">
          {FUNCTIONAL_CLASSES.map((item) => (
            /* Расшифровка подсказкой: отметок два десятка, и полный текст
               рядом с каждой превратил бы поле в страницу. */
            <label key={item} className="checkbox" title={functionalClassLabel(item)}>
              <input
                type="checkbox"
                checked={listOf(props.profile.functionalClasses).includes(item)}
                disabled={props.busy}
                onChange={() => toggle('functionalClasses', FUNCTIONAL_CLASSES, item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="muted small">
        {purpose === null
          ? 'Назначение определится по классу: Ф5.1 — производственное, Ф5.2 — складское, Ф4 — административное, Ф1 — Ф3 — общественное.'
          : `Назначение по классу: ${purpose}. От него зависят расстояние до огнетушителя и потребность в передвижных.`}
      </p>

      <div className="field">
        <span>Классы возможного пожара</span>
        <div className="fire-classes">
          {FIRE_CLASSES.map((item) => (
            <label key={item} className="checkbox">
              <input
                type="checkbox"
                checked={listOf(props.profile.fireClasses).includes(item)}
                disabled={props.busy}
                onChange={() => toggle('fireClasses', FIRE_CLASSES, item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
