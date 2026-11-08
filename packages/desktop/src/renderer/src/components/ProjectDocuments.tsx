/**
 * Рабочая и проектная документация по системе (ТЗ, Дополнение 6).
 *
 * Хранится у прибора приёмно-контрольного, а не у каждого извещателя: проект
 * один на систему, и класть его копию в каждую карточку значило бы плодить
 * расхождения — правку внесли в одну, а предъявили другую.
 *
 * Файлы показаны значками, как в проводнике: документ узнают по виду и имени,
 * а не читают строчку списка. Класть их можно перетаскиванием в любое место
 * блока или кнопкой. В хранилище файл попадает по содержимому: один и тот же
 * проект, добавленный дважды, занимает место один раз.
 */

import { useRef, useState } from 'react';
import type { StoredDocumentReference } from '@izh/contracts';
import { FileGlyph } from './FileGlyph';

export interface ProjectDocumentsProps {
  readonly value: readonly StoredDocumentReference[];
  readonly busy: boolean;
  readonly onChange: (value: readonly StoredDocumentReference[]) => void;
}

/** Расширение по имени файла: хранилище раскладывает файлы по нему. */
function extensionOf(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase('ru');
  return extension === undefined || extension === fileName ? 'bin' : extension;
}

export function ProjectDocuments(props: ProjectDocumentsProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = async (files: readonly File[]): Promise<void> => {
    const added: StoredDocumentReference[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stored = await window.izh.store.put(bytes, extensionOf(file.name));
      if (!stored.ok) { setError(stored.error.message); return; }
      // Один и тот же файл дважды не показывается: в хранилище он и так один,
      // а две одинаковые плитки выглядят ошибкой ввода.
      if (props.value.some((item) => item.hash === stored.value)) continue;
      added.push({ hash: stored.value, fileName: file.name });
    }
    if (added.length === 0) return;
    setError(null);
    props.onChange([...props.value, ...added]);
  };

  const open = (document: StoredDocumentReference): void => {
    void window.izh.openStoredDocument(document.hash).then((result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const save = (document: StoredDocumentReference): void => {
    void window.izh.saveStoredDocument(document.hash, document.fileName).then((result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const empty = props.value.length === 0;

  return (
    <section
      className={`project-documents${over ? ' over' : ''}`}
      // Перетащить можно в любое место блока, а не только в пунктирную рамку:
      // рамка исчезает, как только файлы появились, и целиться было бы некуда.
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (props.busy) return;
        void add([...event.dataTransfer.files]);
      }}
    >
      <h4>Проектная документация системы пожарной автоматики</h4>

      {empty ? (
        <div className="drop-zone">
          <span className="muted small">Перетащите сюда файл</span>
          <button type="button" className="link" disabled={props.busy} onClick={() => inputRef.current?.click()}>
            выбрать на диске
          </button>
        </div>
      ) : (
        <ul className="file-tiles">
          {props.value.map((file) => (
            <li key={file.hash}>
              <button
                type="button"
                className="file-tile"
                title={`${file.fileName} — открыть`}
                onClick={() => open(file)}
              >
                <FileGlyph fileName={file.fileName} />
                <span className="file-tile-name">{file.fileName}</span>
              </button>
              <span className="file-tile-actions">
                <button type="button" className="link" onClick={() => save(file)}>скачать</button>
                <button
                  type="button"
                  className="link danger"
                  disabled={props.busy}
                  onClick={() => props.onChange(props.value.filter((item) => item.hash !== file.hash))}
                >
                  убрать
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!empty && (
        <div className="actions-left">
          <button type="button" disabled={props.busy} onClick={() => inputRef.current?.click()}>
            Добавить ещё
          </button>
          <span className="muted small">или перетащите файл в этот блок</span>
        </div>
      )}

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        multiple
        accept=".pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,image/*"
        onChange={(event) => {
          void add([...(event.target.files ?? [])]);
          if (inputRef.current !== null) inputRef.current.value = '';
        }}
      />

      {empty && (
        <p className="muted small">
          Рабочая документация, проект СПЗ, акты приёмки — всё, что предъявляют по системе целиком.
        </p>
      )}
      {error !== null && <p className="error small">{error}</p>}
    </section>
  );
}
