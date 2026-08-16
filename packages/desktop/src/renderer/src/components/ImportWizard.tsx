/**
 * Мастер создания подложки из загруженного файла.
 *
 * Показывает страницы документа, даёт выбрать страницу, разрешение и поворот, и
 * заранее сообщает, каким получится изображение. Пользователь не должен узнавать
 * о том, что подложка вышла в тридцать мегапикселей, уже после ожидания.
 */

import { useEffect, useState } from 'react';
import type { PdfDocumentInfo, PdfPageContentInfo, PdfPageInfo, QuarterTurn } from '@izh/contracts';
import { DPI_PRESETS, planSourceEngine } from '@izh/engine-plan-source';
import { formatMegapixels, formatPageSizeMm, formatPixels } from '../format';

export interface ImportWizardProps {
  readonly fileName: string;
  readonly documentInfo: PdfDocumentInfo;
  readonly bytes: Uint8Array;
  readonly busy: boolean;
  readonly onCreate: (pageNumber: number, dpi: number, rotation: QuarterTurn) => void;
  readonly onCancel: () => void;
}

const ROTATIONS: readonly QuarterTurn[] = [0, 90, 180, 270];

export function ImportWizard(props: ImportWizardProps): React.JSX.Element {
  const [pageNumber, setPageNumber] = useState(1);
  const [dpi, setDpi] = useState(150);
  const [rotation, setRotation] = useState<QuarterTurn>(0);
  const [content, setContent] = useState<PdfPageContentInfo | null>(null);

  const page: PdfPageInfo | undefined = props.documentInfo.pages.find((p) => p.pageNumber === pageNumber);

  // Разбор содержимого страницы небыстрый, поэтому делается только для выбранной.
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    void planSourceEngine.inspectPdfPage(props.bytes, pageNumber).then((result) => {
      if (!cancelled && result.ok) setContent(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [props.bytes, pageNumber]);

  if (page === undefined) return <div className="panel">Страница не найдена.</div>;

  const estimate = planSourceEngine.estimateRasterSize(page, dpi, rotation);

  return (
    <div className="wizard">
      <h2>Создание подложки</h2>
      <p className="muted">{props.fileName}</p>

      {props.documentInfo.pageCount > 1 && (
        <label className="field">
          <span>Страница</span>
          <select value={pageNumber} onChange={(e) => setPageNumber(Number(e.target.value))}>
            {props.documentInfo.pages.map((p) => (
              <option key={p.pageNumber} value={p.pageNumber}>
                Страница {p.pageNumber} — {formatPageSizeMm(p.widthPt, p.heightPt)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="field-row">
        <label className="field">
          <span>Разрешение подложки</span>
          <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            {DPI_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset} точек на дюйм
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Поворот</span>
          <select value={rotation} onChange={(e) => setRotation(Number(e.target.value) as QuarterTurn)}>
            {ROTATIONS.map((angle) => (
              <option key={angle} value={angle}>
                {angle === 0 ? 'Как есть' : `${angle}°`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <dl className="facts">
        <dt>Размер листа</dt>
        <dd>{formatPageSizeMm(page.widthPt, page.heightPt)}</dd>

        <dt>Подложка получится</dt>
        <dd className={estimate.tooLarge ? 'warn' : ''}>
          {formatPixels(estimate.widthPx, estimate.heightPx)}, {formatMegapixels(estimate.megapixels)}
        </dd>

        <dt>Содержимое страницы</dt>
        <dd>
          {content === null && 'определяется…'}
          {content !== null && content.likelyVector && (
            <>
              векторный чертёж — {content.vectorPathCount} линий, {content.textItemCount} подписей
              <div className="muted small">
                Из такого чертежа в дальнейшем можно будет извлечь стены и помещения автоматически.
              </div>
            </>
          )}
          {content !== null && content.likelyScan && (
            <>
              похоже на скан
              <div className="muted small">
                Разметку помещений придётся делать вручную — в файле нет ни линий, ни подписей.
              </div>
            </>
          )}
          {content !== null && !content.likelyVector && !content.likelyScan && 'страница почти пустая'}
        </dd>
      </dl>

      {estimate.tooLarge && (
        <p className="error">
          При таком разрешении подложка слишком велика и будет тормозить. Выберите разрешение поменьше.
        </p>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={props.onCancel} disabled={props.busy}>
          Отмена
        </button>
        <button
          type="button"
          className="primary"
          disabled={estimate.tooLarge || props.busy}
          onClick={() => props.onCreate(pageNumber, dpi, rotation)}
        >
          {props.busy ? 'Строится…' : 'Создать подложку'}
        </button>
      </div>
    </div>
  );
}
