import type { AppSettings, JournalExportFormat, JournalExportRequest, MaintenanceEvent, PlanObject, TreeNode } from '@izh/contracts';
import { SelectField } from './SelectField';
import { activityCellsForObject, elementByCode, isExtinguisherType, nodeTitle, pathToNode, serviceLifeEndsOn, serviceLifeYearsOf } from '@izh/core';
import { useState } from 'react';
import { formatDateRu } from '../format';
import { todayIso } from '../today';

interface Props {
  readonly object: PlanObject;
  readonly nodes: readonly TreeNode[];
  readonly settings: AppSettings;
  readonly events: readonly MaintenanceEvent[];
  readonly onExport: (request: JournalExportRequest) => void;
}

export function ExtinguisherCardView(props: Props): React.JSX.Element | null {
  if (!isExtinguisherType(props.object.typeCode)) return null;
  const rows = cardRows(props.object, props.nodes, props.events);
  const formats: readonly Exclude<JournalExportFormat, 'print'>[] = ['pdf', 'word', 'excel'];
  return <section className="gost-card"><h4>Карточка учёта огнетушителя</h4>
    <p className="muted small">Обязательные сведения сформированы автоматически из полей карточки.</p>
    <dl className="gost-card-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="gost-card-signature">
      <span>Ответственное лицо: {props.object.responsible ?? ''}</span>
      <span>Подпись: ____________________</span>
    </div>
        {/*
      * Формат выбирают списком, а не тремя кнопками подряд.
      *
      * Заказчик: «кнопка выгрузить карточку должна быть с выпадающим списком,
      * в котором пользователь выбирает, в каком формате выгружать». Три
      * кнопки читались как три разных действия, хотя действие одно.
      * Предвыбран формат из настроек — обычно им и пользуются.
      */}
    <CardExport formats={formats} settings={props.settings} onExport={(format) => props.onExport(
      buildExtinguisherCardExportRequest(format, props.object, props.nodes, props.events, organizationName(props.nodes)),
    )} />
  </section>;
}

/** Выбор формата и одна кнопка «Выгрузить». */
function CardExport(props: {
  readonly formats: readonly Exclude<JournalExportFormat, 'print'>[];
  readonly settings: AppSettings;
  readonly onExport: (format: Exclude<JournalExportFormat, 'print'>) => void;
}): React.JSX.Element {
  const [format, setFormat] = useState(props.settings.defaultExtinguisherCardFormat);
  return (
    <div className="card-export-actions">
      <span className="muted small">Выгрузить карточку:</span>
      <SelectField
        value={format}
        options={props.formats.map((item) => ({ value: item, title: formatLabel(item) }))}
        onChange={(value) => setFormat(value as Exclude<JournalExportFormat, 'print'>)}
      />
      <button type="button" className="primary" onClick={() => props.onExport(format)}>Выгрузить</button>
    </div>
  );
}

function cardRows(object: PlanObject, nodes: readonly TreeNode[], events: readonly MaintenanceEvent[]): readonly (readonly [string, string])[] {
  const profile = object.extinguisherProfile;
  const place = installationPlace(nodes, object);
  const model = [elementByCode(object.typeCode)?.title, object.model].filter(Boolean).join(', ');
  const serviceLifeYears = serviceLifeYearsOf(object);
  const serviceLifeEnd = profile?.serviceLifeEndsOn ?? serviceLifeEndsOn(profile?.manufacturedOn, serviceLifeYears);
  const serviceLife = [
    serviceLifeYears === null ? null : `${serviceLifeYears} лет`,
    serviceLifeEnd === null ? null : `до ${date(serviceLifeEnd)}`,
  ].filter(Boolean).join('; ');
  const recharge = activityCellsForObject(object, events, todayIso(), 14)
    .find((cell) => cell.rule.activityCode === 'perezaryadka')?.schedule;
  const rechargeIsManufactureBased = recharge?.lastDate != null
    && profile?.manufacturedOn === recharge.lastDate
    && !events.some((event) => event.objectId === object.id && event.activityCode === 'perezaryadka');
  const rechargeValue = recharge?.lastDate == null
    ? ''
    : rechargeIsManufactureBased
      ? `следующая: ${date(recharge.nextDate)}; база: дата изготовления ${date(recharge.lastDate)}`
      : `последняя: ${date(recharge.lastDate)}; следующая: ${date(recharge.nextDate)}`;
  return [
    ['Учётный номер', object.regNumber ?? ''],
    ['Дата размещения', date(profile?.placedOn ?? object.commissionedOn)],
    ['Место установки', place],
    ['Тип и модель', model],
    ['Изготовитель', object.manufacturer ?? ''],
    ['Заводской номер', object.serialNumber ?? ''],
    ['Дата изготовления', date(profile?.manufacturedOn)],
    ['Перезарядка', rechargeValue],
    ['Срок службы', serviceLife],
  ];
}

export function buildExtinguisherCardExportRequest(
  format: Exclude<JournalExportFormat, 'print'>,
  object: PlanObject,
  nodes: readonly TreeNode[],
  events: readonly MaintenanceEvent[],
  organization: string,
): JournalExportRequest {
  const rows = cardRows(object, nodes, events);
  const title = `Карточка учёта огнетушителя № ${object.regNumber ?? object.id}`;
  const body = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:"IBM Plex Sans",Arial,sans-serif;color:#162327;font-size:11pt}h1{text-align:center;font-size:16pt;font-weight:600;margin:0 0 5mm;padding-top:5mm;border-top:2px solid #176a75}.org{text-align:center;color:#536266;margin-bottom:8mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #536266;padding:7px;text-align:left;vertical-align:top}th{width:42%;font-weight:600;background:#f3f2ee}.footer{margin-top:12mm;border-top:1px solid #c9cfcc;padding-top:4mm}</style></head><body><h1>${escapeHtml(title)}</h1><div class="org">${escapeHtml(organization || 'Организация не указана')}</div><table>${body}</table><div class="footer">Ответственное лицо: ${escapeHtml(object.responsible ?? '____________________')} &nbsp;&nbsp; Подпись: ____________________</div></body></html>`;
  const excelRows = [[title, ''], ['Организация', organization], ...rows, ['', ''], ['Ответственное лицо', object.responsible ?? ''], ['Подпись', '']];
  const csv = excelRows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\r\n');
  // Карточка — одна вкладка: заголовок сверху, дальше пары «графа — значение».
  // Ширины заданы по смыслу, а не по самому длинному значению: слева всегда
  // название графы, справа — её значение, и колонки не должны прыгать от
  // карточки к карточке.
  const sheet = {
    name: 'Карточка огнетушителя',
    rows: excelRows,
    rowKinds: ['заголовок' as const],
    columnWidths: [38, 46],
    frozenRows: 0,
  };
  return { format, suggestedName: safeName(title), html, csv, sheets: [sheet], landscape: false };
}

function date(value: string | null | undefined): string { return value == null ? '' : formatDateRu(value); }
function installationPlace(nodes: readonly TreeNode[], object: PlanObject): string {
  const path = pathToNode(nodes, object.nodeId).filter((node) => ['shop', 'building', 'level', 'storage'].includes(node.kind));
  return path.map((node) => `${nodeKindLabel(node.kind)} ${nodeTitle(node)}`).join(', ');
}
function nodeKindLabel(kind: TreeNode['kind']): string {
  if (kind === 'shop') return 'цех';
  if (kind === 'building') return 'здание';
  if (kind === 'level') return 'этаж';
  if (kind === 'storage') return 'склад';
  return '';
}
function escapeHtml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function safeName(value: string): string { return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 120); }
function formatLabel(format: string): string { return format === 'pdf' ? 'PDF' : format === 'word' ? 'Word' : 'Excel'; }

/**
 * Наименование организации для печатной карточки.
 *
 * Берётся из дерева объекта, а не из настроек: организация заводится именно
 * там, и держать её название вторым местом значило бы разойтись с деревом при
 * первом же переименовании.
 */
function organizationName(nodes: readonly import('@izh/contracts').TreeNode[]): string {
  return nodes.find((node) => node.kind === 'organization')?.name ?? '';
}
