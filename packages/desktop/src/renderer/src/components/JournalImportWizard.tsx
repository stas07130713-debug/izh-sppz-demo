/**
 * Мастер переноса существующего журнала (Дополнение 1, части Д12–Д13).
 *
 * Четыре шага: выбор разделов → сопоставление колонок → предпросмотр →
 * создание. Разделов может быть несколько: в учётном журнале предприятия
 * листов десяток, и переносить их по одному, открывая мастер заново, — та же
 * работа, помноженная на десять. Отмеченные разделы проходят сопоставление по
 * очереди, а записи создаются один раз, в конце: одна операция в истории и
 * один ответ о том, что получилось.
 * Разделение на шаги не украшение: главное требование Д13 — «импортёр не
 * должен угадывать молча», а значит между чтением файла и записью в журнал
 * обязательно стоит человек, который видит, что программа поняла, и может это
 * исправить.
 *
 * Разбор файла делает движок E7, разбор значений и сопоставление — ядро. Здесь
 * только показ и сбор решений пользователя.
 */

import { useMemo, useState } from 'react';
import { backdropClose } from './modal-backdrop';
import type { JournalSheet, PlanObject, TreeNode } from '@izh/contracts';
import {
  buildImportPreview,
  detectHeaderRow,
  filledRowCount,
  guessTypeFromSheetName,
  elementsFor,
  hasAmbiguity,
  matchColumns,
  type ColumnMatch,
  type ImportPreview,
  type TargetField,
} from '@izh/core';
import { journalSourceEngine } from '@izh/engine-journal-source';
import { ImportSheetPicker, isImportable, type SheetInfo } from './ImportSheetPicker';
import { ElementTypePicker } from './ElementTypePicker';
import { SelectField } from './SelectField';
import { endSentence } from '../format';

/** Куда можно отправить колонку: подписи для выпадающего списка. */
const TARGET_TITLES: Readonly<Record<TargetField, string>> = {
  regNumber: 'Учётный номер',
  model: 'Марка, модель',
  placement: 'Место установки (в примечание)',
  responsible: 'Ответственный',
  technicalState: 'Техническое состояние',
  lastCheck: 'Дата последней проверки',
  lastRecharge: 'Дата последней перезарядки',
  note: 'Примечание',
  ignore: 'Не переносить',
};

const TARGET_ORDER: readonly TargetField[] = [
  'ignore',
  'regNumber',
  'model',
  'placement',
  'responsible',
  'technicalState',
  'lastCheck',
  'lastRecharge',
  'note',
];

export interface ImportedRow {
  readonly typeCode: string;
  readonly regNumber: string | null;
  readonly model: string | null;
  readonly responsible: string | null;
  readonly technicalState: PlanObject['technicalState'];
  readonly note: string | null;
  readonly lastCheck: string | null;
  /** Из какой колонки взята дата проверки: по ней узнаётся, какая это проверка. */
  readonly checkHeader: string | null;
  readonly lastRecharge: string | null;
}

export interface JournalImportWizardProps {
  /** Узел, в который создаются объекты: выбранный этаж, склад или здание. */
  readonly node: TreeNode;
  readonly existingObjects: readonly PlanObject[];
  readonly busy: boolean;
  readonly onClose: () => void;
  /**
   * Создать записи. Мастер уже отфильтровал строки и собрал общие поля.
   *
   * Пароль спрашивается следом, отдельным окном подписи, и один раз на весь
   * перенос. Заказчик: «при переносе журнала пользователь один раз вводит
   * пароль и подписывает ПЭП, а программа сама проставляет в каждую вновь
   * созданную строку ПЭП».
   */
  readonly onImport: (rows: readonly ImportedRow[]) => void;
  /**
   * Вправе ли этот человек подписывать.
   *
   * Кто не вправе — не переносит: перенос заводит записи журнала, а запись
   * журнала без подписи в этой программе не заводится вовсе.
   */
  readonly canSign: boolean;
  /** Чем человек не вправе подписывать — словами, если не вправе. */
  readonly signHint: string | null;
  /** Кто подпишет перенос. Показывается, чтобы человек видел, чьей подписью. */
  readonly signerName: string | null;
}

/**
 * Один ответ на всякий негодный файл.
 *
 * Заказчик: «просто указывать, что данные не опознаны — приложите файл с
 * журналом СППЗ». Причина дописывается следом одной фразой: человеку нужно
 * знать не только что не вышло, но и почему — иначе он приложит тот же файл
 * ещё раз.
 */
const NOT_RECOGNIZED = 'Данные не опознаны. Приложите файл с журналом СППЗ.';

type Step = 'file' | 'sheet' | 'mapping' | 'preview';

export function JournalImportWizard(props: JournalImportWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('file');
  const [fileName, setFileName] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [sheets, setSheets] = useState<readonly SheetInfo[]>([]);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  /** Разделы, ещё не прошедшие сопоставление, и уже собранные из пройденных строки. */
  const [queue, setQueue] = useState<readonly string[]>([]);
  const [collected, setCollected] = useState<readonly ImportedRow[]>([]);
  const [sheet, setSheet] = useState<JournalSheet | null>(null);
  const [headerRow, setHeaderRow] = useState<number | null>(null);
  const [matches, setMatches] = useState<readonly ColumnMatch[]>([]);
  /**
   * Вид оборудования раздела. Пусто — человек ещё не выбрал.
   *
   * Раньше здесь по умолчанию стоял огнетушитель. Если подсказки не было,
   * раздел молча оказывался огнетушителями — и пожарные краны переносились в
   * огнетушители, если человек не заметил подставленного вида. Пустое значение
   * заставляет сделать выбор, а не отменять чужой.
   */
  const [baseTypeCode, setBaseTypeCode] = useState<string>('');
  /** Чем подсказана подстановка вида. null — подсказки не было. */
  const [guess, setGuess] = useState<ReturnType<typeof guessTypeFromSheetName>>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  /** Что делать с дубликатами учётных номеров: решение пользователя, а не догадка. */
  const [duplicateAction, setDuplicateAction] = useState<'пропустить' | 'создать'>('пропустить');

  /*
   * Доступны все разделы, на каком бы узле ни стояли.
   *
   * Заказчик: «при загрузке журнала, не важно, на каком уровне объекта
   * находится пользователь, пусть для переноса будут доступны все разделы —
   * снаружи здания, внутри и автоматика, — а уже потом далее выбирается
   * месторасположение. Иначе сложно».
   *
   * И правда сложно: старый журнал приносят целиком, одной книгой на
   * предприятие, и делить его по уровням до переноса неоткуда. Раньше набор
   * видов зависел от выбранного узла — на здании предлагалось только
   * наружное оборудование, и раздел с огнетушителями перенести было нельзя,
   * не сходив сначала на этаж.
   *
   * Место установки задаётся дальше, графой «Место установки» при
   * сопоставлении колонок.
   */
  /*
   * Виды берутся из библиотеки систем, а не из всего каталога.
   *
   * Заказчик: «в выпадающем списке существующего в нашей программе
   * оборудования откуда-то взялись "планы эвакуации и знаки" и прочее, чего мы
   * не обсуждали; оставь только то, что мы определяем в библиотеке систем».
   *
   * Раньше список строился из «чем можно заменить оборудование» — а это весь
   * каталог: подвиды (шесть видов огнетушителей вместо одного), оборудование
   * внутри систем автоматики (извещатели и оповещатели заводятся составом
   * прибора) и служебные виды вроде плана эвакуации. Перенести раздел журнала
   * в такой вид нельзя, а выбрать его было можно.
   */
  const availableTypes = useMemo(() => {
    const all = [...elementsFor('general'), ...elementsFor('floor'), ...elementsFor('storage')];
    const seen = new Set<string>();
    return all.filter((type) => {
      if (seen.has(type.typeCode)) return false;
      seen.add(type.typeCode);
      return true;
    });
  }, []);

  /**
   * Разбор принесённого файла — одинаковый и для выбранного, и для брошенного.
   *
   * Способ доставки на разбор не влияет: важно, что это за файл, а не как он
   * сюда попал. Держать два разбора значило бы чинить ошибки дважды.
   */
  const acceptFile = async (name: string, sourceBytes: Uint8Array): Promise<void> => {
    setAnalyzing(true);
    setError(null);
    // Даём интерфейсу показать состояние чтения до синхронного разбора книги.
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    try {
    if (sourceBytes.byteLength > 50 * 1024 * 1024) {
      setError('Файл больше 50 МБ. Сохраните рабочие листы в отдельную книгу .xlsx и повторите загрузку.');
      return;
    }
    /*
     * Опознание идёт до всякого разбора и стоит доли секунды.
     *
     * Заказчик: «программа зависает, когда загружаешь файл, который не
     * является журналом; нужно просто указывать, что данные не опознаны».
     * Раньше ответ на вопрос «а это книга Excel?» требовал распаковать архив
     * целиком — и на документе Word с картинками окно замирало. Теперь
     * читаются только имена частей книги.
     */
    const kind = journalSourceEngine.detectKind(sourceBytes);
    if (kind === null) {
      setError(NOT_RECOGNIZED + ' Это не книга Excel: нужен файл .xlsx или .xlsm.');
      return;
    }

    const workbook = journalSourceEngine.probeWorkbook(sourceBytes);
    if (!workbook.ok) return setError(`${NOT_RECOGNIZED} ${workbook.error.message}`);

    /*
     * Листы читаются сразу, все.
     *
     * Иначе выбирать пришлось бы вслепую: имя листа не говорит, есть ли в нём
     * данные, а в книгах учёта всегда лежат заготовки и листы с подписями.
     * Журналы предприятия невелики, и прочитать их целиком дешевле, чем
     * заставлять человека открывать пустой лист и возвращаться.
     */
    const probed: SheetInfo[] = [];
    for (const sheetName of workbook.value.sheetNames) {
      const read = journalSourceEngine.readSheet(sourceBytes, sheetName);
      if (!read.ok) {
        probed.push({ name: sheetName, dataRows: 0, headerRow: null });
        continue;
      }
      const headerRowIndex = detectHeaderRow(read.value.rows);
      /*
       * Строки считает ядро, а не разметка.
       *
       * Прежде строка считалась данными, если хоть одна ячейка не пуста, — и
       * типовой бланк раздела с заранее проставленной нумерацией 1, 2, 3…
       * попадал в список годных к переносу. По существу он чистый.
       */
      const dataRows = filledRowCount(read.value.rows, headerRowIndex);
      probed.push({ name: sheetName, dataRows, headerRow: headerRowIndex });
    }

    if (!probed.some(isImportable)) {
      setError(
        `${NOT_RECOGNIZED} В книге нет таблиц с понятными заголовками и строками оборудования. `
        + 'Названия и порядок колонок могут быть любыми — важен их смысл.',
      );
      return;
    }

    setFileName(name);
    setBytes(sourceBytes);
    setSheets(probed);
    // Годные отмечены сразу: чаще переносят всё, что есть, а снять галочку
    // проще, чем поставить десять.
    setChosen(new Set(probed.filter(isImportable).map((item) => item.name)));
    setCollected([]);
    setStep('sheet');
    } catch (cause) {
      setError(`${NOT_RECOGNIZED} ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const openFile = (): void => {
    setError(null);
    void window.izh.openJournalFile().then((opened) => {
      if (!opened.ok) return setError(opened.error.message);
      if (opened.value === null) return;
      void acceptFile(opened.value.fileName, opened.value.bytes);
    });
  };

  /**
   * Файл, брошенный в окно.
   *
   * Берётся первый: журнал переносят по одному листу одного файла, и молча
   * взять из пачки какой-то один было бы хуже, чем сказать об этом прямо.
   */
  const dropFile = (dropped: FileList | null): void => {
    setError(null);
    setDragOver(false);
    const file = dropped?.[0];
    if (file === undefined) return;
    if (dropped !== null && dropped.length > 1) {
      setError('Перенесите один файл: журнал читается по одному листу одного файла.');
      return;
    }
    void file.arrayBuffer().then((buffer) => acceptFile(file.name, new Uint8Array(buffer)));
  };

  /**
   * Открывает сопоставление колонок для очередного раздела.
   *
   * Пустая очередь означает, что разделы кончились и пора создавать записи.
   */
  const chooseSheet = (name: string): void => {
    if (bytes === null) return;
    setError(null);

    const read = journalSourceEngine.readSheet(bytes, name);
    if (!read.ok) return setError(read.error.message);

    const detected = detectHeaderRow(read.value.rows);
    if (detected === null) {
      setError(
        `На листе «${name}» не удалось найти строку заголовков. Возможно, это не таблица учёта — выберите другой лист.`,
      );
      return;
    }

    const header = read.value.rows[detected] ?? [];
    setSheet(read.value);
    setHeaderRow(detected);
    setMatches(matchColumns(header));

    /*
     * Вид подставляется по названию раздела — это подсказка, а не решение.
     *
     * Названия разделов у каждого предприятия свои, и ошибиться легко:
     * неверный вид уводит весь раздел журнала не туда, а замечают это уже
     * после переноса. Поэтому программа называет вид и говорит, по какому
     * слову решила, а переключить его можно всегда.
     */
    const guessed = guessTypeFromSheetName(name);
    setGuess(guessed);
    setBaseTypeCode(
      guessed !== null && availableTypes.some((type) => type.typeCode === guessed.typeCode)
        ? guessed.typeCode
        : '',
    );

    setStep('mapping');
  };

  const preview: ImportPreview | null = useMemo(() => {
    if (sheet === null || headerRow === null) return null;
    return buildImportPreview({
      rows: sheet.rows,
      headerRowIndex: headerRow,
      matches,
      existingObjects: props.existingObjects,
      baseTypeCode,
    });
  }, [sheet, headerRow, matches, props.existingObjects, baseTypeCode]);

  const changeTarget = (index: number, target: TargetField): void => {
    setMatches((current) =>
      current.map((match, i) =>
        i === index ? { ...match, target, confidence: 'высокая', reason: 'Выбрано пользователем' } : match,
      ),
    );
  };

  /**
   * Строки текущего раздела, готовые к созданию.
   *
   * Отделены от отправки: разделов бывает несколько, и строки копятся до
   * последнего. Создавать их по одному разделу значило бы дробить одну
   * операцию переноса на несколько записей в истории.
   */
  const currentRows = (): readonly ImportedRow[] => {
    if (preview === null) return [];

    const wanted = preview.rows.filter(
      (row) => row.verdict === 'создать' || (row.verdict === 'дубликат' && duplicateAction === 'создать'),
    );

    return (
      wanted.map((row) => ({
        typeCode: row.typeCode,
        regNumber: row.regNumber,
        model: row.model,
        responsible: row.responsible,
        technicalState: row.technicalState,
        // Место установки из чужого журнала — это текст («Учебная башня, 2-й
        // этаж», «АЦ 4.0-60»), а не узел нашего дерева. Сопоставлять его с
        // деревом автоматически нельзя без подтверждения человеком, поэтому
        // текст сохраняется в примечании: сведения не теряются, а объект
        // заводится в выбранный узел.
        note: [row.placement === null ? null : `Место по журналу: ${row.placement}`, row.note]
          .filter((part) => part !== null)
          .join('; ') || null,
        lastCheck: row.lastCheck,
        checkHeader: row.checkHeader,
        lastRecharge: row.lastRecharge,
      }))
    );
  };

  /**
   * Закончить раздел: следующий — или создание записей, если он был последним.
   */
  const finishSheet = (): void => {
    const rows = [...collected, ...currentRows()];
    const rest = queue.slice(1);

    if (rest.length === 0) {
      props.onImport(rows);
      return;
    }

    setCollected(rows);
    setQueue(rest);
    const next = rest[0];
    if (next !== undefined) chooseSheet(next);
  };

  return (
    <div className="modal-backdrop" {...backdropClose(props.onClose)}>
      <div className="modal wizard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h3>Перенос существующего журнала</h3>
          <button type="button" className="link" onClick={props.onClose}>
            закрыть ✕
          </button>
        </div>

        <div className="wizard-steps">
          <span className={step === 'file' ? 'wizard-step active' : 'wizard-step'}>1. Файл</span>
          <span className={step === 'sheet' ? 'wizard-step active' : 'wizard-step'}>2. Разделы</span>
          <span className={step === 'mapping' ? 'wizard-step active' : 'wizard-step'}>3. Колонки</span>
          <span className={step === 'preview' ? 'wizard-step active' : 'wizard-step'}>4. Проверка</span>
        </div>

        {error !== null && <p className="small error">{error}</p>}

        {step === 'file' && (
          <section>
            <p>
              Программа прочитает ваш учётный журнал в Excel и покажет, что поняла, до того как что-либо
              создаст. Ничего не будет записано без вашего подтверждения.
            </p>
            <p className="muted small">
              Записи будут созданы в узле «{props.node.name}». Место установки из журнала сохранится в
              примечании: сопоставить его с деревом объекта автоматически программа пока не берётся.
            </p>
            {/* Перенести файл мышью — самый короткий путь: журнал обычно уже
                открыт в проводнике рядом. Кнопка остаётся для тех, кому проще
                выбрать файл через окно системы. */}
            <div
              className={dragOver ? 'drop-zone over' : 'drop-zone'}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => { event.preventDefault(); dropFile(event.dataTransfer.files); }}
            >
              <p>Перетащите сюда файл журнала .xlsx</p>
              <p className="muted small">или</p>
              <button type="button" className="primary" disabled={analyzing} onClick={openFile}>
                {analyzing ? 'Проверяем файл…' : 'Выбрать файл журнала'}
              </button>
            </div>
          </section>
        )}

        {step === 'sheet' && (
          <ImportSheetPicker
            fileName={fileName}
            sheets={sheets}
            selected={chosen}
            onToggle={(name) => setChosen((current) => {
              const next = new Set(current);
              if (next.has(name)) next.delete(name);
              else next.add(name);
              return next;
            })}
            onNext={() => {
              const order = sheets
                .filter((sheet) => isImportable(sheet) && chosen.has(sheet.name))
                .map((sheet) => sheet.name);
              setQueue(order);
              setCollected([]);
              const first = order[0];
              if (first !== undefined) chooseSheet(first);
            }}
          />
        )}

        {step === 'mapping' && sheet !== null && (
          <section>
            <p className="muted small">
              Раздел «{sheet.name}», заголовки найдены в строке {(headerRow ?? 0) + 1}.
              {queue.length > 1 && ` Разделов осталось: ${queue.length}.`}
              {collected.length > 0 && ` Уже отобрано записей: ${collected.length}.`}
            </p>

            {/*
              * Слева — как раздел называется в принесённом журнале, справа —
              * чему он отвечает у нас. Двумя графами рядом, а не одним полем:
              * человек сверяет два названия, и держать одно из них в памяти
              * значит ошибаться на разделе, который назван непривычно.
              */}
            <div className="import-match">
              <div className="import-match-side">
                <span className="muted small">Раздел в вашем журнале</span>
                <strong>{sheet.name}</strong>
              </div>
              <span className="import-match-arrow" aria-hidden="true">→</span>
              <div className="import-match-side">
                <span className="muted small">Вид оборудования в программе</span>
                <ElementTypePicker
                  types={availableTypes}
                  value={baseTypeCode}
                  onChange={setBaseTypeCode}
                />
                {guess !== null && guess.typeCode === baseTypeCode ? (
                  <span className="muted small">подобрано по слову «{guess.matched}» — проверьте и поправьте</span>
                ) : (
                  <span className="muted small">похожего раздела не нашлось — выберите сами</span>
                )}
              </div>
            </div>
            {baseTypeCode === 'extinguisher' && (
              <p className="muted small">
                Для огнетушителей подтип определится по марке: ОП — порошковый, ОУ — углекислотный, ОВЭ —
                водный. От этого зависит срок перезарядки.
              </p>
            )}

            <h4>Сопоставление колонок</h4>
            {hasAmbiguity(matches) && (
              <p className="small warn">
                Есть колонки, претендующие на одно поле. Выберите нужную, лишние поставьте «Не переносить».
              </p>
            )}

            <table className="journal-table mapping-table">
              <thead>
                <tr>
                  <th>Колонка в вашем файле</th>
                  <th>Поле программы</th>
                  <th>Уверенность</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match, index) =>
                  match.sourceHeader.trim() === '' ? null : (
                    <tr key={`${match.sourceHeader}-${index}`}>
                      <td>{match.sourceHeader}</td>
                      <td>
                        <SelectField
                          value={match.target}
                          options={TARGET_ORDER.map((target) => ({ value: target, title: TARGET_TITLES[target] }))}
                          onChange={(value) => changeTarget(index, value as TargetField)}
                        />
                      </td>
                      <td className={confidenceClass(match.confidence)}>
                        {match.confidence}
                        <div className="muted small">{match.reason}</div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            <div className="actions">
              <button type="button" onClick={() => setStep('sheet')}>
                Назад
              </button>
              <button
                type="button"
                className="primary"
                disabled={baseTypeCode === ''}
                title={baseTypeCode === '' ? 'Сначала выберите вид оборудования этого раздела' : undefined}
                onClick={() => setStep('preview')}
              >
                Дальше: проверка
              </button>
            </div>
          </section>
        )}

        {step === 'preview' && preview !== null && (
          <section>
            <h4>Что будет создано</h4>
            <div className="tiles">
              <div className="tile">
                <div className="tile-value">{preview.toCreate}</div>
                <div className="tile-title">записей будет создано</div>
              </div>
              <div className={preview.duplicates > 0 ? 'tile warn-tile' : 'tile'}>
                <div className="tile-value">{preview.duplicates}</div>
                <div className="tile-title">совпадают по учётному номеру</div>
              </div>
              <div className="tile">
                <div className="tile-value">{preview.skipped}</div>
                <div className="tile-title">пустых строк пропущено</div>
              </div>
            </div>

            {preview.duplicates > 0 && (
              <label className="field">
                <span>Что делать с совпадающими номерами</span>
                <SelectField
                  value={duplicateAction}
                  options={[
                    { value: 'пропустить', title: 'Пропустить — оставить существующие записи как есть' },
                    { value: 'создать', title: 'Создать всё равно — номер повторится, разберу позже' },
                  ]}
                  onChange={(value) => setDuplicateAction(value as 'пропустить' | 'создать')}
                />
              </label>
            )}

            {preview.unmappedHeaders.length > 0 && (
              <p className="muted small">
                Колонки без соответствия сохранятся в примечании: {preview.unmappedHeaders.join(', ')}.
              </p>
            )}

            <h4>Первые записи</h4>
            <table className="journal-table">
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>Номер</th>
                  <th>Марка</th>
                  <th>Место по журналу</th>
                  <th>Проверка</th>
                  <th>Итог</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row) => (
                  <tr key={row.sourceRow}>
                    <td className="muted small">{row.sourceRow}</td>
                    <td>{row.regNumber ?? '—'}</td>
                    <td>{row.model ?? '—'}</td>
                    <td className="muted small">{row.placement ?? '—'}</td>
                    <td className="muted small">{row.lastCheck ?? '—'}</td>
                    <td className={verdictClass(row.verdict)}>
                      {row.verdict}
                      {row.warnings.length > 0 && <div className="small warn">{row.warnings[0]}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 && (
              <p className="muted small">Показаны первые 20 строк из {preview.rows.length}.</p>
            )}

            {/*
              * Подпись под переносом — на последнем шаге и один раз.
              *
              * Записи, заведённые переносом, — такие же записи журнала, как
              * сделанные руками, и отвечает за них тот, кто перенёс. Пароль
              * спрашивается следом, отдельным окном, и один раз на весь перенос:
              * подпись подтверждает, что подписал определённый человек (63-ФЗ,
              * статья 5 часть 2), а не то, сколько строк он перенёс.
              */}
            {queue.length <= 1 && (
              <div className="import-sign">
                {props.canSign ? (
                  <p className="muted small">
                    Каждая созданная строка журнала будет подписана вашей простой электронной
                    подписью{props.signerName === null ? '.' : endSentence(`: ${props.signerName}`)}
                  </p>
                ) : (
                  <p className="small warn">
                    {props.signHint ?? 'Подписывать нельзя, поэтому и переносить нельзя.'}
                  </p>
                )}
              </div>
            )}

            <div className="actions">
              <button type="button" onClick={() => setStep('mapping')}>
                Назад
              </button>
              <button
                type="button"
                className="primary"
                disabled={props.busy || preview.toCreate === 0
                  || (queue.length <= 1 && !props.canSign)}
                onClick={finishSheet}
              >
                {/* Пока разделы не кончились, это не конец переноса: записи
                    создаются один раз, после последнего. */}
                {queue.length > 1 ? 'Дальше: следующий раздел' : 'Подписать и перенести'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function confidenceClass(confidence: string): string {
  if (confidence === 'высокая') return 'ok';
  if (confidence === 'средняя') return 'warn';
  return 'error';
}

function verdictClass(verdict: string): string {
  if (verdict === 'создать') return 'ok';
  if (verdict === 'дубликат') return 'error';
  return 'muted';
}
