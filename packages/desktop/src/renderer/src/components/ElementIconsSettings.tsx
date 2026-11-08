/**
 * Свои значки для встроенных видов оборудования.
 *
 * Заказчик: «нужно сделать возможность пользователю самостоятельно менять и
 * назначать значки на системы, какие ему будет удобно; он может подгружать в
 * установленный формат рамки свои картинки». Обозначения на планах у
 * предприятий свои — принятые в проектной документации или в инструкциях, — и
 * навязывать наши незачем.
 *
 * Картинка уменьшается до значка тем же способом, что и у своего вида: значок
 * на плане занимает десятки точек, а настройки читаются при каждом запуске
 * одним документом.
 *
 * Показываются только виды библиотеки: оборудование системы автоматики
 * заводится составом прибора, и менять значок извещателя отдельно от прибора
 * незачем — он и рисуется значком своего семейства.
 *
 * Здесь же меняется и **название** вида. Заказчик: «добавь, чтобы можно было
 * заменять не только сами значки, но и название этих систем». Причина та же,
 * что и у значка: на предприятии оборудование зовут по-своему, и наши слова
 * ему навязывать незачем. Меняется только показываемое название — правила,
 * справочники и ссылки на нормативы остаются за прежним видом.
 */

import { ELEMENT_CATALOG } from '@izh/core';
import { ElementIcon } from './ElementIcon';
import { readIconFile } from './icon-picker';

export interface ElementIconsSettingsProps {
  readonly icons: Readonly<Record<string, string>>;
  readonly onChange: (icons: Readonly<Record<string, string>>) => void;
  /** Свои названия видов: код вида → название, принятое на предприятии. */
  readonly titles: Readonly<Record<string, string>>;
  readonly onChangeTitles: (titles: Readonly<Record<string, string>>) => void;
  readonly onError: (message: string) => void;
}

export function ElementIconsSettings(props: ElementIconsSettingsProps): React.JSX.Element {
  const shown = ELEMENT_CATALOG.filter((type) => type.showInLibrary !== false);

  const set = (typeCode: string, dataUrl: string | null): void => {
    const next = { ...props.icons };
    if (dataUrl === null) delete next[typeCode];
    else next[typeCode] = dataUrl;
    props.onChange(next);
  };

  /**
   * Название: пустая графа означает «как в программе», а не пустое название.
   *
   * Стёртое название иначе осталось бы в настройках пустой строкой и стёрло бы
   * вид во всей программе — в журнале, на плане и в печатных формах.
   */
  const rename = (typeCode: string, title: string): void => {
    const next = { ...props.titles };
    if (title.trim() === "") delete next[typeCode];
    else next[typeCode] = title;
    props.onChangeTitles(next);
  };

  return (
    <section className="settings-section">
      <h4>Значки и названия систем</h4>
      <p className="muted small">
        Если на ваших планах приняты другие обозначения, замените значок своей картинкой, а название —
        тем, которым это оборудование зовут у вас. Замена действует везде: на плане, в библиотеке, в
        журнале, на дашборде и в печатных формах. Картинка уменьшается до значка и хранится вместе с
        настройками; пустая графа названия означает «как в программе».
      </p>

      <ul className="plain-list element-icons">
        {shown.map((type) => {
          const own = props.icons[type.typeCode];
          return (
            <li key={type.typeCode}>
              {/*
                * Замена стоит под самим значком.
                *
                * Заказчик: «нужно, чтобы кнопка „заменить“ была под каждым
                * значком и меняла значок в таком же формате». Прежде она
                * стояла в конце строки, рядом с прочими действиями, и по
                * длинному ряду было не понять, какой значок она заменит.
                */}
              <span className="element-icons-slot">
                <ElementIcon typeCode={type.typeCode} size="large" />
                <label className="link small custom-icon-pick">
                  заменить
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file === undefined) return;
                      void readIconFile(file)
                        .then((result) => {
                          if (!result.ok) { props.onError(result.error); return; }
                          set(type.typeCode, result.dataUrl);
                        })
                        .catch(() => props.onError('Картинку прочитать не удалось.'));
                    }}
                  />
                </label>
              </span>
              <label className="element-icons-title">
                <input
                  type="text"
                  value={props.titles[type.typeCode] ?? ""}
                  placeholder={type.title}
                  onChange={(event) => rename(type.typeCode, event.target.value)}
                />
              </label>
              {own !== undefined && <span className="badge muted">свой значок</span>}
              <span className="element-icons-actions">
                {own !== undefined && (
                  <button type="button" className="link small" onClick={() => set(type.typeCode, null)}>
                    вернуть стандартный значок
                  </button>
                )}
                {props.titles[type.typeCode] !== undefined && (
                  <button type="button" className="link small" onClick={() => rename(type.typeCode, "")}>
                    вернуть название
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
