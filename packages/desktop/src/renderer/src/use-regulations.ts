/**
 * Регламенты ТО, их версии, локальные документы и шаблоны.
 *
 * Читаются целиком: регламентов на предприятии десятки, а сборка действующего
 * (движок E3) всё равно нуждается во всём наборе сразу — она обходит дерево от
 * организации к элементу.
 */

import { useCallback, useEffect, useState } from 'react';
import type { LocalDocument, Regulation, RegulationTemplate, RegulationVersion } from '@izh/contracts';

export interface RegulationsState {
  readonly regulations: readonly Regulation[];
  readonly versions: readonly RegulationVersion[];
  readonly documents: readonly LocalDocument[];
  readonly templates: readonly RegulationTemplate[];
  /** Ошибка чтения показывается, а не подменяется пустотой: см. ADR-005. */
  readonly error: string | null;
  readonly reload: () => Promise<void>;
}

export function useRegulations(): RegulationsState {
  const [regulations, setRegulations] = useState<readonly Regulation[]>([]);
  const [versions, setVersions] = useState<readonly RegulationVersion[]>([]);
  const [documents, setDocuments] = useState<readonly LocalDocument[]>([]);
  const [templates, setTemplates] = useState<readonly RegulationTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const [loadedRegulations, loadedVersions, loadedDocuments, loadedTemplates] = await Promise.all([
      window.izh.regulations.list(),
      window.izh.regulations.listVersions(),
      window.izh.regulations.listDocuments(),
      window.izh.regulations.listTemplates(),
    ]);

    const failed = [loadedRegulations, loadedVersions, loadedDocuments, loadedTemplates].find((item) => !item.ok);
    if (failed !== undefined && !failed.ok) {
      setError(failed.error.message);
      return;
    }

    setError(null);
    if (loadedRegulations.ok) setRegulations(loadedRegulations.value);
    if (loadedVersions.ok) setVersions(loadedVersions.value);
    if (loadedDocuments.ok) setDocuments(loadedDocuments.value);
    if (loadedTemplates.ok) setTemplates(loadedTemplates.value);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { regulations, versions, documents, templates, error, reload };
}
