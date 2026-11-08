/**
 * Заведение строки в журнал заверяется простой электронной подписью.
 *
 * Заказчик: «при заведении нового огнетушителя или элемента, и вообще при
 * создании новых строк в журнале должна ставиться ПЭП».
 *
 * Строка журнала — про оборудование, и до первой проверки под ней нет ни одной
 * записи. Подписывается поэтому само заведение: кто внёс единицу оборудования в
 * журнал и за какие сведения о ней отвечает.
 *
 * Проверяется главное: подпись встаёт при заведении, относится к содержимому
 * карточки, без подписи строка не заводится вовсе, и правка подписанных
 * сведений видна при сверке.
 */

import { describe, expect, it } from 'vitest';
import type { ObjectDeps } from '../objects/object-deps.js';
import type { Signer } from '../access/signer.js';
import { placeObject, updateObject } from '../objects/object-scenarios.js';
import { checkSignature } from '../access/simple-signature.js';
import { signedObjectContent } from '../access/signed-content.js';
import { fakeClock, fakeIdGenerator, fakePlanObjectRepository } from './test-doubles.js';
import { fakePasswordHasher } from './access-doubles.js';
import { makeSampleTree, makeTreeDeps, value } from './tree-fixtures.js';
import { user } from './import-signature-doubles.js';

const hasher = fakePasswordHasher();

async function stand(): Promise<{ deps: ObjectDeps; levelId: string; signer: Signer }> {
  const treeDeps = makeTreeDeps();
  const { level } = await makeSampleTree(treeDeps);

  // Отпечаток пароля считается тем же хешем, каким его потом проверяют.
  const digest = await hasher.hash('верный-пароль-1');
  if (!digest.ok) throw new Error('не удалось завести пароль');

  return {
    deps: { objects: fakePlanObjectRepository(), tree: treeDeps.tree, clock: fakeClock(), ids: fakeIdGenerator() },
    levelId: level.id,
    signer: { user: { ...user, password: digest.value }, password: 'верный-пароль-1', hasher },
  };
}

describe('подпись под заведением строки в журнал', () => {
  it('подпись встаёт на вновь заведённую строку', async () => {
    const { deps, levelId, signer } = await stand();

    const placed = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
      regNumber: 'ОП-12', model: 'ОП-5', signer,
    }));

    expect(placed.registrationSignature).not.toBeNull();
    expect(placed.registrationSignature?.signerName).toBe(user.fullName);
    expect(placed.registrationSignature?.kind).toBe('заведение в журнал');
  });

  it('подпись сверяется с содержимым карточки', async () => {
    const { deps, levelId, signer } = await stand();
    const placed = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
      regNumber: 'ОП-12', signer,
    }));

    const проверка = await checkSignature(
      hasher, placed.registrationSignature ?? null, signedObjectContent(placed),
    );
    expect(проверка.ok).toBe(true);
    if (проверка.ok) expect(проверка.value.verdict).toBe('подпись верна');
  });

  it('правка подписанных сведений видна при сверке', async () => {
    const { deps, levelId, signer } = await stand();
    const placed = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
      regNumber: 'ОП-12', signer,
    }));

    // Учётный номер входит в подписанное: подписавший отвечал именно за него.
    const changed = value(await updateObject(deps, { id: placed.id, regNumber: 'ОП-99' }));

    const проверка = await checkSignature(
      hasher, changed.registrationSignature ?? null, signedObjectContent(changed),
    );
    expect(проверка.ok).toBe(true);
    if (проверка.ok) expect(проверка.value.verdict).toBe('содержимое изменено');
  });

  it('неверный пароль не заводит строку вовсе', async () => {
    const { deps, levelId, signer } = await stand();

    const placed = await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
      regNumber: 'ОП-12', signer: { ...signer, password: 'не тот пароль' },
    });

    expect(placed.ok).toBe(false);
    const stored = await deps.objects.listByNode(levelId);
    expect(stored.ok && stored.value).toHaveLength(0);
  });

  it('кто подписывать не вправе, тот и строку не заводит', async () => {
    const { deps, levelId, signer } = await stand();
    const гость = { ...signer, user: { ...signer.user, role: 'гость' as const } };

    const placed = await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
      regNumber: 'ОП-12', signer: гость,
    });

    expect(placed.ok).toBe(false);
    if (!placed.ok) expect(placed.error.code).toBe('FORBIDDEN');
    const stored = await deps.objects.listByNode(levelId);
    expect(stored.ok && stored.value).toHaveLength(0);
  });

  it('без подписывающего строка заводится: так работают служебные сценарии', async () => {
    const { deps, levelId } = await stand();
    const placed = value(await placeObject(deps, {
      nodeId: levelId, typeCode: 'extinguisher-powder', position: { x: 10, y: 10 },
    }));
    expect(placed.registrationSignature).toBeUndefined();
  });
});
