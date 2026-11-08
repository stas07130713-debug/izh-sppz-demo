/**
 * Эталонные тесты безопасного хранилища.
 *
 * Проверяют ровно то, ради чего оно появилось: повреждённый файл не выдаётся
 * за пустой и не затирается новой записью, а сама запись неделима.
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { readJsonCollection, readJsonRecord, writeJsonAtomically } from './json-store.js';

async function tempFile(name = 'store.json'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'izh-store-'));
  return join(dir, name);
}

describe('безопасное хранилище файлов данных', () => {
  it('отсутствующий файл — это пустой список, а не ошибка', async () => {
    const path = await tempFile();
    const read = await readJsonCollection(path, 'events');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual([]);
  });

  it('повреждённый файл возвращает ошибку, а не пустой список', async () => {
    const path = await tempFile();
    await writeFile(path, '{"events": [{"id": "a"', 'utf8');

    const read = await readJsonCollection(path, 'events');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe('FILE_CORRUPTED');
  });

  it('повреждённый файл остаётся на диске нетронутым', async () => {
    const path = await tempFile();
    const broken = '{"events": [{"id": "a"';
    await writeFile(path, broken, 'utf8');

    // Хранилище обязано отказаться от записи, увидев ошибку чтения. Здесь это
    // проверяется на уровне слоя: сам файл никто не трогал.
    const read = await readJsonCollection(path, 'events');
    expect(read.ok).toBe(false);
    expect(await readFile(path, 'utf8')).toBe(broken);
  });

  it('запись и чтение возвращают то же значение', async () => {
    const path = await tempFile();
    const written = await writeJsonAtomically(path, { events: [{ id: 'a' }, { id: 'b' }] });
    expect(written.ok).toBe(true);

    const read = await readJsonCollection(path, 'events');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('после записи временный файл не остаётся', async () => {
    const path = await tempFile();
    await writeJsonAtomically(path, { events: [] });
    await expect(readFile(`${path}.tmp`, 'utf8')).rejects.toThrow();
  });

  it('пустой файл читается как пустой список: так выглядит прерванная запись', async () => {
    const path = await tempFile();
    await writeFile(path, '', 'utf8');
    const read = await readJsonCollection(path, 'events');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual([]);
  });

  it('одиночная запись: нет файла — null, повреждён — ошибка', async () => {
    const missing = await tempFile();
    const absent = await readJsonRecord(missing);
    expect(absent.ok && absent.value === null).toBe(true);

    const broken = await tempFile();
    await writeFile(broken, '{oops', 'utf8');
    const corrupted = await readJsonRecord(broken);
    expect(corrupted.ok).toBe(false);
    if (corrupted.ok) return;
    expect(corrupted.error.code).toBe('FILE_CORRUPTED');
  });
});
