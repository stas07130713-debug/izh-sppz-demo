/**
 * Перенос журнала заверяется простой электронной подписью.
 *
 * Заказчик: «при массовом переносе элементов с загруженного стороннего журнала
 * тот, кто это сделал, должен подтвердить своей ПЭП, и в журнале это должно
 * быть отображено… пользователь один раз вводит пароль и подписывает ПЭП, а
 * программа сама проставляет в каждую вновь созданную строку ПЭП».
 *
 * Проверяется главное: подпись встаёт на каждую строку, у каждой свой отпечаток,
 * и наполовину заверенного переноса не бывает.
 */

import { describe, expect, it } from 'vitest';
import { recordMaintenanceBatchSigned } from '../rules/maintenance-scenarios.js';
import { checkSignature } from '../access/simple-signature.js';
import { signedJournalContent } from '../access/signed-content.js';
import { makeMaintenanceDeps, object, user, hasher } from './import-signature-doubles.js';

describe('подпись под перенесённым журналом', () => {
  it('подпись встаёт на каждую созданную строку', async () => {
    const deps = await makeMaintenanceDeps();

    const created = await recordMaintenanceBatchSigned(deps.deps, [
      { objectId: object.id, activityCode: 'ezhegodnaya-proverka', performedOn: '2026-08-01', result: 'выполнено', checklist: [], note: 'Перенесено из существующего журнала' },
      { objectId: object.id, activityCode: 'perezaryadka', performedOn: '2026-07-01', result: 'выполнено', checklist: [], note: 'Перенесено из существующего журнала' },
    ], { user, password: 'верный-пароль-1', hasher });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value).toHaveLength(2);
    for (const event of created.value) {
      expect(event.signature).not.toBeNull();
      expect(event.signature?.signerName).toBe(user.fullName);
    }

    // Отпечаток у каждой строки свой: иначе по одной подписи «на всё» нельзя
    // было бы сказать, какая именно строка изменилась после подписания.
    const [первая, вторая] = created.value;
    expect(первая?.signature?.contentHash).not.toBe(вторая?.signature?.contentHash);
  });

  it('подпись сверяется с содержимым строки', async () => {
    const deps = await makeMaintenanceDeps();
    const created = await recordMaintenanceBatchSigned(deps.deps, [
      { objectId: object.id, activityCode: 'ezhegodnaya-proverka', performedOn: '2026-08-01', result: 'выполнено', checklist: [], note: 'Перенесено из существующего журнала' },
    ], { user, password: 'верный-пароль-1', hasher });
    if (!created.ok) throw new Error('перенос не состоялся');

    const event = created.value[0];
    if (event === undefined) throw new Error('нет записи');

    const проверка = await checkSignature(hasher, event.signature ?? null, signedJournalContent(event));
    expect(проверка.ok).toBe(true);
    if (проверка.ok) expect(проверка.value.verdict).toBe('подпись верна');
  });

  it('неверный пароль не заводит ни одной строки', async () => {
    const deps = await makeMaintenanceDeps();

    const created = await recordMaintenanceBatchSigned(deps.deps, [
      { objectId: object.id, activityCode: 'ezhegodnaya-proverka', performedOn: '2026-08-01', result: 'выполнено', checklist: [], note: '' },
      { objectId: object.id, activityCode: 'perezaryadka', performedOn: '2026-07-01', result: 'выполнено', checklist: [], note: '' },
    ], { user, password: 'не-тот-пароль', hasher });

    expect(created.ok).toBe(false);
    // Наполовину заверенный перенос хуже незаверенного: по нему не скажешь,
    // где кончается ответственность подписавшего.
    expect(await deps.saved()).toHaveLength(0);
  });

  it('кто не вправе подписывать — тот не переносит', async () => {
    const deps = await makeMaintenanceDeps();
    const гость = { ...user, role: 'гость' as const };

    const created = await recordMaintenanceBatchSigned(deps.deps, [
      { objectId: object.id, activityCode: 'ezhegodnaya-proverka', performedOn: '2026-08-01', result: 'выполнено', checklist: [], note: '' },
    ], { user: гость, password: 'верный-пароль-1', hasher });

    expect(created.ok).toBe(false);
    expect(await deps.saved()).toHaveLength(0);
  });
});
