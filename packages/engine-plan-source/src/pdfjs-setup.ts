/**
 * Подключение библиотеки pdf.js.
 *
 * pdf.js разбирает PDF в отдельном рабочем потоке. Создать этот поток может
 * только тот, кто собирает программу, потому что путь к файлу потока зависит от
 * сборщика. Поэтому движок не создаёт поток сам, а принимает его снаружи —
 * иначе движок оказался бы привязан к конкретному инструменту сборки, что
 * запрещено правилом 1 в AGENTS.md.
 *
 * Интерфейс вызывает setPdfWorkerPort один раз при запуске программы.
 */

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

let workerConfigured = false;

export function setPdfWorkerPort(port: Worker): void {
  pdfjs.GlobalWorkerOptions.workerPort = port;
  workerConfigured = true;
}

export function isPdfWorkerConfigured(): boolean {
  return workerConfigured;
}

/**
 * Открывает документ PDF.
 *
 * Байты копируются намеренно: pdf.js забирает переданный буфер себе и после
 * работы оставляет его пустым. Без копии повторное чтение того же файла
 * завершилось бы ошибкой.
 */
export async function openPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  if (!workerConfigured) {
    throw new Error(
      'Рабочий поток pdf.js не настроен. Интерфейс обязан вызвать setPdfWorkerPort при запуске.',
    );
  }

  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // Выполнение кода из PDF запрещено: файлы приходят от посторонних.
    isEvalSupported: false,
  });

  return task.promise;
}

export { pdfjs };
