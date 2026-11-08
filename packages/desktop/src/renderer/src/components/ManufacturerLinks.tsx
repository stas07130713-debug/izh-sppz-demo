/**
 * Ссылки изготовителя в карточке огнетушителя.
 *
 * Две разные вещи, и путать их нельзя:
 *
 * - страница изделия на сайте завода. Есть почти у всех, и по ней сверяют
 *   заряд, ранг и срок службы;
 * - паспорт или руководство отдельным файлом. Есть у немногих: большинство
 *   заводов кладёт паспорт в коробку и в сеть не выкладывает.
 *
 * Обе открываются браузером системы. Своим окном программа внешние страницы не
 * показывает: в нём нет ни адресной строки, ни кнопки «назад», и страница
 * выглядит неработающей.
 *
 * Кнопки «скачать» здесь нет и не будет. Справочник хранит адрес, а не файл;
 * что по адресу лежит сегодня, программа не знает. Прежняя кнопка сохраняла
 * под именем «.pdf» страницу с ошибкой — открыть такой файл было нечем.
 *
 * Самого адреса рядом нет. Заказчик: «не нужно указывать путь сайта,
 * достаточно просто ссылку». Адреса паспортов длиной в две строки —
 * с кодировкой кириллицы в них — занимали в карточке больше места, чем
 * все её поля, и ничего человеку не сообщали. Куда ведёт ссылка, видно
 * во всплывающей подсказке.
 */

export interface ManufacturerLinksProps {
  readonly officialUrl: string | null;
  readonly passportUrl: string | null;
}

function open(url: string): void {
  void window.izh.openExternal(url);
}

export function ManufacturerLinks(props: ManufacturerLinksProps): React.JSX.Element | null {
  if (props.officialUrl === null && props.passportUrl === null) return null;

  return (
    <div className="passport-actions">
      {props.officialUrl !== null && (
        <span className="passport-line">
          <strong className="small">Страница изделия:</strong>
          <button
            type="button"
            className="link"
            title={props.officialUrl}
            onClick={() => open(props.officialUrl as string)}
          >
            открыть на сайте изготовителя
          </button>
        </span>
      )}
      {props.passportUrl !== null && (
        <span className="passport-line">
          <strong className="small">Паспорт изделия:</strong>
          <button
            type="button"
            className="link"
            title={props.passportUrl}
            onClick={() => open(props.passportUrl as string)}
          >
            открыть файл на сайте изготовителя
          </button>
        </span>
      )}
    </div>
  );
}
