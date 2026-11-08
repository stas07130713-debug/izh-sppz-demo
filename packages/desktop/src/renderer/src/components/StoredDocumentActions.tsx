import { useState } from 'react';
import type { StoredDocumentReference } from '@izh/contracts';

interface Props {
  readonly document: StoredDocumentReference;
}

export function StoredDocumentActions(props: Props): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);

  const open = (): void => {
    void window.izh.openStoredDocument(props.document.hash).then((result) => {
      setMessage(result.ok ? null : result.error.message);
    });
  };

  const save = (): void => {
    void window.izh.saveStoredDocument(props.document.hash, props.document.fileName).then((result) => {
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setMessage(result.value.savedPath === null ? null : `Сохранено: ${result.value.savedPath}`);
    });
  };

  return (
    <span className="stored-document-actions">
      <button type="button" className="link" onClick={open}>{props.document.fileName}</button>
      <button type="button" className="link" onClick={save}>скачать</button>
      {message !== null && <span className="error small">{message}</span>}
    </span>
  );
}
