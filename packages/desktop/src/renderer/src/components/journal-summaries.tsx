/**
 * Как журнал показывает сведения карточек и сроки.
 *
 * Вынесено из самой панели: у каждого вида оборудования своя графа карточки,
 * и вместе с разметкой таблицы всё это не помещалось в один файл. Здесь —
 * только превращение объекта в строку журнала, без состояний и обработчиков.
 *
 * Каждая графа — одна строка из того, что заполнено: прочерки в пять граф
 * читать труднее, чем короткую строку из того, что есть.
 */

import type { MaintenanceEvent, PlanObject } from '@izh/contracts';
import {
  requiredFenceHeight,
  serviceLifeEndsOn,
  serviceLifeYearsOf,
  waterNetworkSign,
  waterSourceVolumeSign,
  type ActivityCell,
  type ActivityRule,
  type ScheduleStatus,
} from '@izh/core';
import { formatDateRu } from '../format';
export interface JournalCellPairProps {
  readonly cell: ActivityCell;
  readonly onOpen: () => void;
}

/** Пара колонок одного мероприятия: дата последнего выполнения и плановая следующая. */
export function JournalCellPair(props: JournalCellPairProps): React.JSX.Element {
  const { schedule } = props.cell;
  return (
    <>
      <td className="journal-cell muted small">{schedule.lastDate === null ? '—' : formatDateRu(schedule.lastDate)}</td>
      <td className="journal-cell">
        {/* Щелчок по сроку открывает проверку, а не карточку: иначе он дошёл
            бы до строки, которая теперь тоже нажимается. */}
        <button
          type="button"
          className={`status-cell ${statusClass(schedule.status)}`}
          onClick={(event) => { event.stopPropagation(); props.onOpen(); }}
        >
          <span className="status-dot" />
          {schedule.status === 'нет данных' || schedule.nextDate === null ? (
            <span className="small">нет данных</span>
          ) : (
            <span className="small">{formatDateRu(schedule.nextDate)}</span>
          )}
        </button>
      </td>
    </>
  );
}

export function statusClass(status: ScheduleStatus): string {
  if (status === 'норма') return 'status-ok';
  if (status === 'скоро') return 'status-warn';
  if (status === 'просрочено') return 'status-danger';
  return 'status-unknown';
}

export function technicalStatusClass(state: PlanObject['technicalState']): string {
  if (state === 'неисправен' || state === 'забракован') return 'status-danger';
  if (state === 'исправен с замечаниями' || state === 'требует ремонта' || state === 'на ТО') return 'status-warn';
  if (state === 'исправен') return 'status-ok';
  return 'status-unknown';
}

/** Обязательные сведения карточки по приложению А ГОСТ Р 59641-2021. */
export function extinguisherCardSummary(object: PlanObject): string {
  const profile = object.extinguisherProfile;
  const values: string[] = [];
  addValue(values, 'ввод', profile?.placedOn ?? object.commissionedOn);
  addValue(values, 'тип/модель', object.model);
  addValue(values, 'изготовитель', object.manufacturer);
  addValue(values, 'зав. №', object.serialNumber);
  addValue(values, 'изготовлен', profile?.manufacturedOn);
  addValue(values, 'срок службы', serviceLifeSummary(object));
  addValue(values, 'ответственный', object.responsible);
  return values.join('; ');
}

export function serviceLifeSummary(object: PlanObject): string | null {
  const profile = object.extinguisherProfile;
  const years = serviceLifeYearsOf(object);
  const end = profile?.serviceLifeEndsOn ?? serviceLifeEndsOn(profile?.manufacturedOn, years);
  const parts = [
    years === null ? null : `${years} лет`,
    end === null ? null : `до ${end}`,
  ].filter((value) => value !== null);
  return parts.length === 0 ? null : parts.join(', ');
}

export function addValue(target: string[], label: string, value: string | null | undefined): void {
  if (value !== null && value !== undefined && value.trim() !== '') target.push(`${label}: ${value}`);
}

export function lastServiceSummary(object: PlanObject, events: readonly MaintenanceEvent[]): string {
  const latest = events.filter((event) => event.objectId === object.id)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt))[0];
  if (latest === undefined) return '';
  const executor = latest.executorDetails;
  const external = latest.externalEvidence;
  if (external !== null && external !== undefined) {
    return `${formatDateRu(latest.performedOn)}; ${external.organization}; акт № ${external.actNumber} от ${formatDateRu(external.actDate)}; ${external.actFile.fileName}`;
  }
  if (executor !== null && executor !== undefined) {
    return `${formatDateRu(latest.performedOn)}; ${executor.fullName}, ${executor.position}, ${executor.organization}`;
  }
  return `${formatDateRu(latest.performedOn)}; ${latest.executor ?? 'исполнитель не указан'}`;
}

/** Периодичность словами для подписи под заголовком колонки — как в макете заказчика. */
export function periodicityLabel(rule: ActivityRule): string {
  const months = rule.periodicityMonths;
  if (months === null) return 'по регламенту';
  if (months === 1) return 'ежемесячно';
  if (months === 3) return '1 раз в квартал';
  if (months === 12) return '1 раз в год';
  if (months % 12 === 0) return `1 раз в ${months / 12} лет`;
  return `1 раз в ${months} мес.`;
}

/**
 * Убирает повторы работ, сохраняя порядок первой встречи.
 *
 * Один и тот же вид оборудования в разных цехах может идти по разным
 * регламентам, и колонка нужна для каждой встреченной работы — но ровно одна.
 * Порядок берётся от первого объекта: он же задаёт порядок в чек-листе, и
 * менять его при переходе между цехами значило бы путать пользователя.
 */
export function dedupeRules(rules: readonly ActivityRule[]): readonly ActivityRule[] {
  const seen = new Map<string, ActivityRule>();
  for (const rule of rules) {
    if (!seen.has(rule.activityCode)) seen.set(rule.activityCode, rule);
  }

  // Колонки идут от частого срока к редкому — тем же порядком, что строки в
  // карточке и группы в чек-листе. Порядок появления правил у первого объекта
  // случаен и на разных этажах давал разный порядок колонок.
  const months = (rule: ActivityRule): number => {
    const value = rule.periodicityMonths;
    return value === null || value === undefined || value <= 0 ? 1 : value;
  };
  return [...seen.values()].sort((a, b) => months(a) - months(b));
}

/**
 * Данные карточки пожарного крана одной графой журнала.
 *
 * Всё, что заполнено в карточке, должно быть видно и в журнале: журнал
 * предъявляют проверяющему, и заставлять его открывать карточку каждого крана
 * нельзя. Незаполненное пропускается — прочерки в четыре строки читать труднее,
 * чем короткую строку из того, что есть.
 */
export function hydrantCardSummary(object: PlanObject): string {
  const profile = object.hydrantProfile;
  if (profile === null || profile === undefined) return '—';

  const parts = [
    profile.valveBore === null ? null : `клапан ${profile.valveBore}`,
    profile.hoseDiameter === null ? null : `рукав ${profile.hoseDiameter}`,
    profile.couplingHead === null ? null : `головка ${profile.couplingHead}`,
    profile.nozzleBore === null ? null : `спрыск ${profile.nozzleBore}`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Вид преграды и предел огнестойкости одной графой журнала.
 *
 * Это то, по чему преграду опознают и проверяют: журнал предъявляют
 * проверяющему, и заставлять его открывать карточку каждой двери нельзя.
 */
export function barrierCardSummary(object: PlanObject): string {
  const profile = object.fireBarrierProfile;
  if (profile === null || profile === undefined) return '—';

  const parts = [profile.barrierKind, profile.fireResistance]
    .filter((part): part is string => part !== null && part !== '');
  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Огнезащитная обработка одной графой журнала.
 *
 * Состав, площадь и до какого числа держится обработка — то, по чему судят,
 * нужна ли она заново. Дата окончания считается от даты обработки и срока по
 * документации: её не вводят руками, чтобы не разошлась с исходными числами.
 */
export function fireproofingCardSummary(object: PlanObject): string {
  const profile = object.fireproofingProfile;
  if (profile === null || profile === undefined) return '—';

  const expires = profile.treatedOn === null || profile.warrantyYears === null
    ? null
    : `до ${formatDateRu(`${Number(profile.treatedOn.slice(0, 4)) + profile.warrantyYears}${profile.treatedOn.slice(4)}`)}`;

  const parts = [
    profile.treatmentKind,
    profile.material,
    profile.areaM2 === null ? null : `${profile.areaM2} м²`,
    profile.requirement,
    expires,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Ограждение кровли одной графой журнала.
 *
 * Высота ограждения пишется рядом с требуемой: целое ограждение бывает ниже
 * положенного, и по одной цифре этого не увидеть.
 */
export function roofFenceCardSummary(object: PlanObject): string {
  const profile = object.roofFenceProfile;
  if (profile === null || profile === undefined) return '—';

  const required = requiredFenceHeight(profile.buildingHeightM);
  const height = profile.fenceHeightM === null
    ? null
    : `высота ${profile.fenceHeightM} м${required === null ? '' : ` (норма ${required} м)`}`;

  const parts = [
    profile.roofKind === null ? null : `кровля ${profile.roofKind}`,
    profile.buildingHeightM === null ? null : `здание ${profile.buildingHeightM} м`,
    height,
    profile.fenceLengthM === null ? null : `длина ${profile.fenceLengthM} м`,
    profile.coating === null ? null : `покрытие ${profile.coating}`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Пожарный щит одной графой журнала.
 *
 * Инвентарь перечисляется полностью: щит без багра и вёдер числится, но не
 * работает, и проверяющий смотрит именно на этот список.
 */
export function fireBoardCardSummary(object: PlanObject): string {
  const profile = object.fireBoardProfile;
  if (profile === null || profile === undefined) return '—';

  const parts = [
    profile.place,
    profile.inventory.length === 0 ? 'инвентарь не отмечен' : `на щите: ${profile.inventory.join(', ')}`,
    profile.sandBoxM3 === null ? null : `песок ${profile.sandBoxM3} м³`,
    profile.waterBarrelL === null ? null : `вода ${profile.waterBarrelL} л`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Насосная станция одной графой журнала.
 *
 * Рабочие и резервные насосы пишутся порознь: станция с одним рабочим и без
 * резервного своей задачи не выполняет.
 */
export function pumpStationCardSummary(object: PlanObject): string {
  const profile = object.pumpStationProfile;
  if (profile === null || profile === undefined) return '—';

  const pumps = [
    profile.workingPumps === null ? null : `рабочих ${profile.workingPumps}`,
    profile.standbyPumps === null ? null : `резервных ${profile.standbyPumps}`,
  ].filter((part): part is string => part !== null);

  const parts = [
    profile.purpose,
    pumps.length === 0 ? null : `насосов: ${pumps.join(', ')}`,
    profile.capacityLps === null ? null : `подача ${profile.capacityLps} л/с`,
    profile.headM === null ? null : `напор ${profile.headM} м`,
    profile.control.length === 0 ? null : `управление: ${profile.control.join(', ')}`,
    profile.backupPower === null ? null : `резервное питание ${profile.backupPower}`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Сведения карточки наружной пожарной лестницы одной графой журнала.
 *
 * Тип определяет объём испытаний, размеры и ограждение — законность самой
 * лестницы: с высоты 6 м ограждение обязательно.
 */
export function ladderCardSummary(object: PlanObject): string {
  const profile = object.ladderProfile;
  if (profile === null || profile === undefined) return '—';

  const size = [
    profile.heightM === null ? null : `высота ${profile.heightM} м`,
    profile.widthM === null ? null : `ширина ${profile.widthM} м`,
  ].filter((part): part is string => part !== null);

  const parts = [
    profile.ladderSubtype ?? profile.ladderType,
    profile.mountingPlace,
    size.length === 0 ? null : size.join(', '),
    profile.railing === null ? null : `ограждение ${profile.railing}`,
    profile.platform === null ? null : `площадка ${profile.platform}`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Сведения карточки пожарного водоисточника одной графой журнала.
 *
 * Объём, способ забора и площадка — то, по чему расчёт решает, ехать ли сюда.
 * Объём подписывается общим при нескольких резервуарах: «V 100» у источника из
 * двух ёмкостей прочли бы как объём каждой.
 */
export function waterSourceCardSummary(object: PlanObject): string {
  const profile = object.waterSourceProfile;
  if (profile === null || profile === undefined) return '—';

  const volume = waterSourceVolumeSign(profile);
  const parts = [
    volume === '' ? null : volume,
    profile.designVolumeM3 === null ? null : `расчётный ${profile.designVolumeM3} м³`,
    (profile.tankCount ?? 1) > 1 ? `резервуаров ${profile.tankCount}` : null,
    profile.execution,
    profile.placement,
    profile.intakeMethod === null ? null : `забор: ${profile.intakeMethod}`,
    profile.pad === null ? null : `площадка ${profile.pad}`,
    profile.vehicleCount === null ? null : `машин одновременно ${profile.vehicleCount}`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Сведения карточки наружного пожарного гидранта одной графой журнала.
 *
 * Сеть, образец и высота — то, по чему к гидранту подъезжают и подбирают
 * колонку. Расстояния с таблички здесь же: их меряют по месту, и в журнале они
 * нужны ровно затем же, зачем на самой табличке.
 */
export function outdoorHydrantCardSummary(object: PlanObject): string {
  const profile = object.outdoorHydrantProfile;
  if (profile === null || profile === undefined) return '—';

  const network = waterNetworkSign(profile);
  // Расстояния подписаны стороной: «влево 12.0» без слова «влево» ничего не
  // говорит, а гидрант стоит в одной конкретной стороне.
  const distances = [
    profile.signDistanceLeftM === null ? null : `влево ${profile.signDistanceLeftM}`,
    profile.signDistanceRightM === null ? null : `вправо ${profile.signDistanceRightM}`,
    profile.signDistanceDownM === null ? null : `к гидранту ${profile.signDistanceDownM}`,
  ].filter((part): part is string => part !== null && part !== '');

  const parts = [
    profile.placementKind,
    profile.pattern,
    network === '' ? null : `сеть ${network}`,
    profile.heightMm === null ? null : `высота ${profile.heightMm} мм`,
    distances.length === 0 ? null : `табличка: ${distances.join(', ')} м`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Сведения карточки прибора приёмно-контрольного одной графой журнала.
 *
 * Исполнение и резервное питание — то, что спрашивают по системе в первую
 * очередь. Время работы без сети считается по ёмкости и количеству вместе,
 * поэтому они пишутся рядом, а не в разных графах.
 */
export function controlPanelCardSummary(object: PlanObject): string {
  const profile = object.controlPanelProfile;
  if (profile === null || profile === undefined) return '—';

  const backup = profile.backupPower;
  // Незаполненное резервное питание не подписывается вовсе: «не выясняли» —
  // не то же самое, что «резервного питания нет», и подменять одно другим в
  // журнале нельзя.
  const battery = backup === null || backup.source === null
    ? null
    : [backup.source, backup.batteryKind, backup.capacityAh === null ? null : `${backup.capacityAh} А·ч`,
       backup.count === null ? null : `${backup.count} шт.`]
      .filter((part): part is string => part !== null && part !== '')
      .join(', ');

  const parts = [
    profile.execution,
    battery,
    profile.projectDocuments.length === 0 ? null : `проект: ${profile.projectDocuments.length} файл(ов)`,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length === 0 ? '—' : parts.join('; ');
}

/**
 * Сведения карточки автономной установки одной графой журнала.
 *
 * Что защищает, как запускается и как обнаруживает пожар — всё, чем установка
 * отличается от соседней такой же. Чем тушит, видно из её вида в шапке. Журнал предъявляют проверяющему, и
 * заставлять его открывать карточку каждого модуля нельзя.
 */
export function suppressionCardSummary(object: PlanObject): string {
  const profile = object.suppressionProfile;
  if (profile === null || profile === undefined) return '—';

  const parts = [
    profile.protectedZone === null ? null : `защищает: ${profile.protectedZone}`,
    profile.startModes.length === 0 ? null : `пуск: ${profile.startModes.join(', ')}`,
    profile.detection === null ? null : `обнаружение: ${profile.detection}`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? '—' : parts.join('; ');
}
