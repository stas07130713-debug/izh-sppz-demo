/**
 * Настройки программы. Пока одна: порог «скоро».
 *
 * До загрузки из хранилища отдаёт значение по умолчанию — журнал не должен
 * ждать лишнего обращения к диску, чтобы просто отрисовать статус.
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@izh/contracts';
import { setCustomElementTypes, setElementTitleOverrides } from '@izh/core';
import { setElementIconOverrides } from './components/element-icon-overrides';

export interface AppSettingsState {
  readonly settings: AppSettings;
  readonly reload: () => Promise<void>;
}

export function useAppSettings(): AppSettingsState {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const reload = useCallback(async (): Promise<void> => {
    const result = await window.izh.settings.get();
    if (!result.ok) return;

    /*
     * Свои виды элементов попадают в реестр ядра здесь, а не в каждом
     * месте, где вид ищут по коду: `elementByCode` вызывается из восьми
     * десятков мест — от значка на плане до заголовка колонки журнала.
     * Настройки читаются при запуске и после каждого сохранения, поэтому
     * другого места, где реестр мог бы отстать, нет.
     */
    setCustomElementTypes(result.value.customElements);
    // Переименования читаются там же, где значки: одним документом настроек.
    setElementTitleOverrides(result.value.elementTitles);
    setElementIconOverrides(result.value.elementIcons);
    setSettings(result.value);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, reload };
}
