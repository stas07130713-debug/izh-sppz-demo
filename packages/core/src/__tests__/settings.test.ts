/**
 * Эталонные тесты порога «скоро» (Дополнение 1, часть Д11).
 */

import { describe, expect, it } from 'vitest';
import type { AppSettings, AppSettingsRepository } from '@izh/contracts';
import { DEFAULT_APP_SETTINGS, ok } from '@izh/contracts';
import type { SettingsDeps } from '../settings/settings-deps.js';
import { updateSoonThreshold } from '../settings/settings-scenarios.js';

function fakeSettingsRepository(): AppSettingsRepository {
  let stored: AppSettings = DEFAULT_APP_SETTINGS;
  return {
    async get() {
      return ok(stored);
    },
    async save(settings) {
      stored = settings;
      return ok(undefined);
    },
  };
}

describe('порог «скоро»', () => {
  it('сохраняет корректное значение', async () => {
    const deps: SettingsDeps = { settings: fakeSettingsRepository() };
    const result = await updateSoonThreshold(deps, 30);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.soonThresholdDays).toBe(30);

    const stored = await deps.settings.get();
    expect(stored.ok && stored.value.soonThresholdDays).toBe(30);
  });

  it('отклоняет нецелое, нулевое и отрицательное значение', async () => {
    const deps: SettingsDeps = { settings: fakeSettingsRepository() };

    expect((await updateSoonThreshold(deps, 1.5)).ok).toBe(false);
    expect((await updateSoonThreshold(deps, 0)).ok).toBe(false);
    expect((await updateSoonThreshold(deps, -5)).ok).toBe(false);
  });

  it('отклоняет значение больше года', async () => {
    const deps: SettingsDeps = { settings: fakeSettingsRepository() };
    expect((await updateSoonThreshold(deps, 400)).ok).toBe(false);
  });
});
