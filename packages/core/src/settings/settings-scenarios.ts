/**
 * Сценарий: изменить порог «скоро».
 *
 * Проверка границ — здесь, а не в форме интерфейса: значение может прийти и
 * не из формы (например, позже — из импорта конфигурации), а правило должно
 * быть одно.
 */

import type { AppSettings, Result } from '@izh/contracts';
import { err, ok } from '@izh/contracts';
import type { SettingsDeps } from './settings-deps.js';

export async function updateSoonThreshold(deps: SettingsDeps, days: number): Promise<Result<AppSettings>> {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return err('INVALID_ARGUMENT', 'Порог «скоро» — это целое число дней от 1 до 365.');
  }

  const current = await deps.settings.get();
  if (!current.ok) return current;
  const settings: AppSettings = { ...current.value, soonThresholdDays: days };
  const saved = await deps.settings.save(settings);
  if (!saved.ok) return saved;
  return ok(settings);
}
