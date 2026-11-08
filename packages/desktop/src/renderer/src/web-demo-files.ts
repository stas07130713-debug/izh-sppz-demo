import type { Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';

/** Выбор файла средствами браузера вместо системного диалога Electron. */
export async function pickBrowserFile(accept: string): Promise<Result<{ fileName: string; bytes: Uint8Array } | null>> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.append(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      if (file === null) { resolve(ok(null)); return; }
      void file.arrayBuffer()
        .then((buffer) => resolve(ok({ fileName: file.name, bytes: new Uint8Array(buffer) })))
        .catch((cause: unknown) => resolve(err('FILE_READ_FAILED', 'Не удалось прочитать файл.', String(cause))));
    }, { once: true });
    input.click();
  });
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function sha256Hex(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
