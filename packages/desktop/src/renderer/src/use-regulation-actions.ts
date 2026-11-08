/**
 * Действия над регламентами: выпуск версии и сохранение шаблона.
 *
 * Вынесено из главного экрана отдельно, потому что это законченный кусок работы
 * со своим предметом. Главный экран занят связыванием частей, а не правилами
 * выпуска версий — ему достаточно знать, что такие действия есть.
 *
 * Смотри docs/04_Дополнение_5_движок_регламентов.md, части Р7, Р9, Р12.
 */

import { useCallback } from 'react';
import type { PlanObject, RegulationPeriodicity } from '@izh/contracts';
import { createRegulation, elementTitle, releaseRegulationVersion, saveRegulationTemplate } from '@izh/core';
import { regulationDeps } from './deps';
import { guardBusy } from './use-busy-run';
import { formatDateRu } from './format';
import { todayIso } from './today';
import { scopeLabel, type RegulationTarget } from './components/regulation-targets';
import type { RegulationsState } from './use-regulations';

export interface RegulationActions {
  readonly release: (
    target: RegulationTarget,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ) => Promise<void>;
  /** Выпуск собственного регламента одного элемента (часть Р7, уровень «элемент»). */
  readonly releaseForObject: (
    object: PlanObject,
    periodicities: readonly RegulationPeriodicity[],
  ) => Promise<void>;
  readonly saveTemplate: (
    title: string,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ) => Promise<void>;
}

export interface RegulationActionsInput {
  readonly state: RegulationsState;
  readonly setBusy: (busy: boolean) => void;
  readonly setMessage: (message: string) => void;
}

export function useRegulationActions(input: RegulationActionsInput): RegulationActions {
  const { state, setBusy, setMessage } = input;

  /**
   * Выпускает регламент выбранного уровня по виду оборудования (части Р7, Р9).
   *
   * Уровень приходит из окна: организация, цех или здание. Регламент цеха не
   * отменяет регламент организации, а дополняет его — сборкой занимается
   * движок, здесь только выпуск.
   *
   * Если своего регламента на этом уровне ещё нет, он создаётся вместе с первой
   * версией. Если есть — выпускается следующая, а прежняя закрывается.
   * Перезаписи не бывает: записи журнала ссылаются на версии, и прошлые
   * проверки обязаны сохранить свой состав работ.
   */
  const release = useCallback(async (
    target: RegulationTarget,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ): Promise<void> => guardBusy(setBusy, setMessage, async () => {

      const existing = state.regulations.find(
        (item) => item.scope === target.scope && item.targetId === target.targetId
          && item.typeCode === typeCode && item.archivedAt === null,
      );

      const today = todayIso();
      const result = existing === undefined
        ? await createRegulation(regulationDeps, {
            title: `Регламент: ${elementTitle(typeCode)} — ${target.label}`,
            scope: target.scope,
            targetId: target.targetId,
            typeCode,
            localDocumentId: null,
            effectiveFrom: today,
            periodicities,
          })
        : await releaseRegulationVersion(regulationDeps, {
            regulationId: existing.id,
            effectiveFrom: today,
            periodicities,
          });

      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      await state.reload();
      setMessage(
        existing === undefined
          ? `Регламент «${elementTitle(typeCode)}» ${scopeLabel(target.scope)} (${target.label}) создан и действует с ${formatDateRu(today)}.`
          : `Выпущена новая версия регламента «${elementTitle(typeCode)}» (${target.label}), действует с ${formatDateRu(today)}. Прежняя версия сохранена.`,
      );
  }), [state, setBusy, setMessage]);

  /**
   * Выпускает собственный регламент одного элемента (часть Р7).
   *
   * Область действия «элемент», привязка — к идентификатору объекта. Типа
   * оборудования у такого регламента нет: он и так относится ровно к одному
   * элементу, а лишнее условие только мешало бы сборке, если элемент когда-то
   * заменят на другой вид.
   */
  const releaseForObject = useCallback(async (
    object: PlanObject,
    periodicities: readonly RegulationPeriodicity[],
  ): Promise<void> => guardBusy(setBusy, setMessage, async () => {

      const existing = state.regulations.find(
        (item) => item.scope === 'элемент' && item.targetId === object.id && item.archivedAt === null,
      );

      const today = todayIso();
      const label = object.regNumber === null
        ? elementTitle(object.typeCode)
        : `${elementTitle(object.typeCode)} № ${object.regNumber}`;

      const result = existing === undefined
        ? await createRegulation(regulationDeps, {
            title: `Особый порядок: ${label}`,
            scope: 'элемент',
            targetId: object.id,
            typeCode: null,
            localDocumentId: null,
            effectiveFrom: today,
            periodicities,
          })
        : await releaseRegulationVersion(regulationDeps, {
            regulationId: existing.id,
            effectiveFrom: today,
            periodicities,
          });

      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      await state.reload();
      setMessage(
        existing === undefined
          ? `Особый порядок для «${label}» задан и действует с ${formatDateRu(today)}. Он добавляется к регламенту организации, а не заменяет его.`
          : `Выпущена новая версия особого порядка для «${label}», действует с ${formatDateRu(today)}.`,
      );
  }), [state, setBusy, setMessage]);

  /**
   * Сохраняет черновик шаблоном (часть Р12).
   *
   * Шаблон ничего не назначает: он лишь заготовка, которую потом применяют к
   * другому цеху или зданию. Действующим регламент становится только выпуском
   * версии — поэтому сообщение об успехе говорит об этом прямо.
   */
  const saveTemplate = useCallback(async (
    title: string,
    typeCode: string,
    periodicities: readonly RegulationPeriodicity[],
  ): Promise<void> => guardBusy(setBusy, setMessage, async () => {
      const result = await saveRegulationTemplate(regulationDeps, {
        title,
        typeCode,
        periodicities,
        localDocumentId: null,
      });

      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      await state.reload();
      setMessage(
        `Шаблон «${result.value.title}» сохранён. Он ничего не меняет, пока его не применить и не выпустить версией.`,
      );
  }), [state, setBusy, setMessage]);

  return { release, releaseForObject, saveTemplate };
}
