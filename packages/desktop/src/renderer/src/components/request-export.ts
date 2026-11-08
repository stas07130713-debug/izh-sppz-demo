/**
 * Заявка на внешний подряд: значения граф и сборка документа
 * (ТЗ, Дополнение 6, часть С54).
 *
 * Оформление берётся общее с журналом (`document-export`): заказчик просит,
 * чтобы заявка выглядела так же. Здесь только то, чем заявка отличается, —
 * какие графы в ней стоят и откуда берётся каждое значение.
 */

import type {
  AppSettings, JournalExportFormat, JournalExportRequest, MaintenanceEvent, PlanObject,
  RequestColumn, RequestTemplate, TreeNode,
} from '@izh/contracts';
import {
  OWN_COLUMN_SOURCE, activityCellsForObject, elementByCode, nodeTitle, responsibleFor,
  technicalStateForObject, type ActivityScheduleSource,
} from '@izh/core';
import { formatDateRu } from '../format';
import { buildDocumentExportRequest } from './document-export';

export interface RequestRowContext {
  readonly nodes: readonly TreeNode[];
  readonly events: readonly MaintenanceEvent[];
  readonly today: string;
  readonly settings: AppSettings;
  readonly source: ActivityScheduleSource;
}

/** Последние замечания по элементу — то, ради чего заявку и подают. */
function defectsOf(object: PlanObject, events: readonly MaintenanceEvent[]): string {
  const latest = events
    .filter((event) => event.objectId === object.id && event.checklist.length > 0)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt))[0];
  if (latest === undefined) return '';

  const defects = latest.checklist
    .filter((item) => item.defect !== null && item.defect.trim() !== '')
    .map((item) => `${item.item}: ${item.defect ?? ''}`);
  return defects.length === 0 ? (latest.defect ?? '') : defects.join('; ');
}

/**
 * Значение одной графы для одного элемента.
 *
 * Своя графа возвращает пустоту намеренно: её заполняют от руки в готовом
 * документе, и подставить туда что-нибудь «похожее» значило бы испортить её.
 */
export function requestCellValue(
  source: string,
  object: PlanObject,
  index: number,
  context: RequestRowContext,
): string {
  const cells = () => activityCellsForObject(
    object, context.events, context.today, context.settings.soonThresholdDays, context.source,
  );

  switch (source) {
    case 'номер': return String(index + 1);
    case 'наименование': return object.model ?? elementByCode(object.typeCode)?.title ?? object.typeCode;
    case 'вид': return elementByCode(object.typeCode)?.title ?? object.typeCode;
    case 'учётный-номер': return object.regNumber ?? '';
    case 'место': {
      const node = context.nodes.find((item) => item.id === object.nodeId);
      return node === undefined ? '' : nodeTitle(node);
    }
    case 'состояние': return technicalStateForObject(object, context.events);
    case 'неисправность': return defectsOf(object, context.events);
    case 'просрочено': {
      const overdue = cells().filter((cell) => cell.schedule.status === 'просрочено');
      return overdue
        .map((cell) => `${cell.rule.title} — с ${cell.schedule.nextDate === null ? '—' : formatDateRu(cell.schedule.nextDate)}`)
        .join('; ');
    }
    case 'ближайший-срок': {
      const dates = cells()
        .map((cell) => cell.schedule.nextDate)
        .filter((date): date is string => date !== null)
        .sort();
      return dates[0] === undefined ? '' : formatDateRu(dates[0]);
    }
    case 'изготовитель': return object.manufacturer ?? '';
    case 'заводской-номер': return object.serialNumber ?? '';
    case 'дата-ввода': return object.commissionedOn === null ? '' : formatDateRu(object.commissionedOn);
    case 'ответственный': return responsibleFor(context.nodes, object) ?? '';
    case 'примечание': return object.note ?? '';
    case OWN_COLUMN_SOURCE: return '';
    default: return '';
  }
}

export interface RequestSnapshot {
  readonly template: RequestTemplate;
  readonly objects: readonly PlanObject[];
  readonly scopeTitle: string;
  readonly context: RequestRowContext;
}

export function requestRows(snapshot: RequestSnapshot): readonly (readonly string[])[] {
  return snapshot.objects.map((object, index) =>
    snapshot.template.columns.map((column) => requestCellValue(column.source, object, index, snapshot.context)));
}

export function buildRequestExportRequest(
  format: JournalExportFormat,
  snapshot: RequestSnapshot,
): JournalExportRequest {
  const { template } = snapshot;
  const headers = template.columns.map((column: RequestColumn) => column.title);

  return buildDocumentExportRequest(format, {
    title: template.documentTitle,
    scopeTitle: snapshot.scopeTitle,
    tables: [{ title: snapshot.scopeTitle, headers, rows: requestRows(snapshot) }],
    footer: template.footer,
  });
}
