/** Редактируемая часть карточки элемента; состояние по проверкам только показывается. */
import { useEffect, useState } from 'react';
import type { AppSettings, ControlPanelProfile, FireBoardProfile, FireproofingProfile, LadderProfile, OutdoorHydrantProfile,
  PumpStationProfile, RoofFenceProfile, WaterSourceProfile, ExtinguisherProfile, FireBarrierProfile, HydrantProfile, SuppressionProfile, MaintenanceEvent, PlanObject, Room, TreeNode } from '@izh/contracts';
import {
  inheritsFromSystem,
  responsibleFor,
  extinguisherManufacturersForType,
  extinguisherModelsForManufacturer,
  extinguisherReferenceByManufacturerAndModel,
  isExtinguisherType,
  isMultiUnitType,
  customElementByCode,
  chargeFromModel,
  impliedProfileFields,
  modelsFor,
  maintenanceDocuments,
  automationModels,
  AUTOMATION_MANUFACTURERS,
  systemOf,
  FIRE_DETECTOR_TYPES,
  SYSTEM_HEAD_TYPE,
  objectProblems,
  blocking,
  warnings,
  serviceLifeEndsOn,
  serviceLifeYearsOf,
} from '@izh/core';
import { formatDateRu } from '../format';
import { todayIso } from '../today';
import { familyOptionsFor } from './equipment-family-options';
import { emptyExtinguisherProfile } from './ExtinguisherProfileFields';
import { ExtinguisherRankFields } from './ExtinguisherRankFields';
import { ManufacturerLinks } from './ManufacturerLinks';
import { EMPTY_HYDRANT_PROFILE, HydrantProfileFields } from './HydrantProfileFields';
import { EMPTY_FIRE_BARRIER, FireBarrierFields } from './FireBarrierFields';
import { EMPTY_SUPPRESSION, SuppressionFields } from './SuppressionFields';
import { EMPTY_CONTROL_PANEL, ControlPanelFields } from './ControlPanelFields';
import { ComboField } from './ComboField';
import { EMPTY_OUTDOOR_HYDRANT, OutdoorHydrantFields } from './OutdoorHydrantFields';
import { HydrantSign } from './HydrantSign';
import { EMPTY_WATER_SOURCE, WaterSourceFields } from './WaterSourceFields';
import { WaterSourceSign } from './WaterSourceSign';
import { EMPTY_LADDER, LadderFields } from './LadderFields';
import { EMPTY_FIREPROOFING, FireproofingFields } from './FireproofingFields';
import { CustomFields, keepKnownFields, type CustomFieldValues } from './CustomFields';
import { SelectField } from './SelectField';
import {
  EMPTY_FIRE_BOARD, EMPTY_PUMP_STATION, EMPTY_ROOF_FENCE,
  FireBoardFields, PumpStationFields, RoofFenceFields,
} from './OutdoorEquipmentFields';

/** Виды пожарного щита: у всех одна карточка. */
const FIRE_BOARD_TYPES: readonly string[] = [
  'outdoor-cabinet', 'fire-board-a', 'fire-board-v', 'fire-board-e',
  'fire-board-sh', 'fire-board-mobile', 'outdoor-cabinet-box',
];

/** Виды пожарного водоисточника: у всех одна карточка и одна табличка. */
const WATER_SOURCE_TYPES: readonly string[] = ['water-reservoir', 'water-pond', 'water-tank', 'water-natural'];
import { StoredDocumentActions } from './StoredDocumentActions';

export interface ObjectFields {
  readonly typeCode: string;
  readonly regNumber: string | null;
  readonly model: string | null;
  readonly manufacturer: string | null;
  readonly serialNumber: string | null;
  readonly commissionedOn: string | null;
  readonly serviceLifeYears: number | null;
  readonly responsible: string | null;
  readonly extinguisherProfile: ExtinguisherProfile | null;
  /** Заполняется только у пожарного крана (Дополнение 6). */
  readonly hydrantProfile?: HydrantProfile | null;
  /** Заполняется только у противопожарной преграды (Дополнение 6). */
  readonly fireBarrierProfile?: FireBarrierProfile | null;
  /** Заполняется только у автономной установки пожаротушения (Дополнение 6). */
  readonly suppressionProfile?: SuppressionProfile | null;
  /** Заполняется только у прибора приёмно-контрольного: он же — вся система (Дополнение 6). */
  readonly controlPanelProfile?: ControlPanelProfile | null;
  /** Заполняется только у наружного пожарного гидранта (Дополнение 6). */
  readonly outdoorHydrantProfile?: OutdoorHydrantProfile | null;
  /** Заполняется только у пожарного водоисточника (Дополнение 6). */
  readonly waterSourceProfile?: WaterSourceProfile | null;
  /** Заполняется только у наружной пожарной лестницы (Дополнение 6). */
  readonly ladderProfile?: LadderProfile | null;
  /** Заполняется только у ограждения кровли (Дополнение 6). */
  readonly roofFenceProfile?: RoofFenceProfile | null;
  /** Заполняется только у огнезащитной обработки (Дополнение 6). */
  readonly fireproofingProfile?: FireproofingProfile | null;
  /** Заполняется только у наружного пожарного щита (Дополнение 6). */
  readonly fireBoardProfile?: FireBoardProfile | null;
  /** Заполняется только у насосной станции (Дополнение 6). */
  readonly pumpStationProfile?: PumpStationProfile | null;
  /** Заполняется только у своего вида элемента (движок E4). */
  readonly customFields?: Readonly<Record<string, string>> | null;
  readonly roomId: string | null;
  readonly note: string | null;
}

interface ObjectDetailsFormProps {
  readonly object: PlanObject;
  /** Дерево: из профиля здания берётся ответственный (Дополнение 6). */
  readonly nodes: readonly TreeNode[];
  readonly rooms: readonly Room[];
  /** Все объекты: по ним проверяются связи и повторы учётных номеров. */
  readonly allObjects: readonly PlanObject[];
  readonly events: readonly MaintenanceEvent[];
  readonly busy: boolean;
  readonly settings: AppSettings;
  readonly onTypeDirtyChange: (dirty: boolean) => void;
  readonly onDraftChange: (fields: ObjectFields) => void;
  readonly onTypeSelected: (fields: ObjectFields) => void;
  readonly onSave: (fields: ObjectFields) => void;
  /**
   * Что показать перед примечанием.
   *
   * Нужен блокам, которые сохраняются отдельно от формы, — сейчас это
   * проектная документация прибора. Держать их снаружи формы нельзя: место
   * им по смыслу среди полей карточки, а не под кнопками действий.
   */
  readonly beforeNote?: React.ReactNode;
}

export function ObjectDetailsForm(props: ObjectDetailsFormProps): React.JSX.Element {
  const { object } = props;
  const [typeCode, setTypeCode] = useState(object.typeCode);
  const [regNumber, setRegNumber] = useState(object.regNumber ?? '');
  const [model, setModel] = useState(object.model ?? '');
  const [manufacturer, setManufacturer] = useState(object.manufacturer ?? '');
  const [manufacturerChoice, setManufacturerChoice] = useState(manufacturerChoiceFor(object.manufacturer));
  const [serialNumber, setSerialNumber] = useState(object.serialNumber ?? '');
  const [commissionedOn, setCommissionedOn] = useState(object.commissionedOn ?? '');
  const [serviceLife, setServiceLife] = useState(serviceLifeYearsOf(object) === null ? '' : String(serviceLifeYearsOf(object)));
  const [responsible, setResponsible] = useState(object.responsible ?? '');
  const [suppressionProfile, setSuppressionProfile] = useState<SuppressionProfile>(object.suppressionProfile ?? EMPTY_SUPPRESSION);
  const [barrierProfile, setBarrierProfile] = useState<FireBarrierProfile>(object.fireBarrierProfile ?? EMPTY_FIRE_BARRIER);
  const [hydrantProfile, setHydrantProfile] = useState<HydrantProfile>(object.hydrantProfile ?? EMPTY_HYDRANT_PROFILE);
  const [controlPanelProfile, setControlPanelProfile] = useState<ControlPanelProfile>(object.controlPanelProfile ?? EMPTY_CONTROL_PANEL);
  const [outdoorHydrantProfile, setOutdoorHydrantProfile] = useState<OutdoorHydrantProfile>(object.outdoorHydrantProfile ?? EMPTY_OUTDOOR_HYDRANT);
  const [waterSourceProfile, setWaterSourceProfile] = useState<WaterSourceProfile>(object.waterSourceProfile ?? EMPTY_WATER_SOURCE);
  const [ladderProfile, setLadderProfile] = useState<LadderProfile>(object.ladderProfile ?? EMPTY_LADDER);
  const [roofFenceProfile, setRoofFenceProfile] = useState<RoofFenceProfile>(object.roofFenceProfile ?? EMPTY_ROOF_FENCE);
  const [fireproofingProfile, setFireproofingProfile] = useState<FireproofingProfile>(object.fireproofingProfile ?? EMPTY_FIREPROOFING);
  const [fireBoardProfile, setFireBoardProfile] = useState<FireBoardProfile>(object.fireBoardProfile ?? EMPTY_FIRE_BOARD);
  const [pumpStationProfile, setPumpStationProfile] = useState<PumpStationProfile>(object.pumpStationProfile ?? EMPTY_PUMP_STATION);
  const [customFields, setCustomFields] = useState<CustomFieldValues>(object.customFields ?? {});
  const [extinguisherProfile, setExtinguisherProfile] = useState<ExtinguisherProfile | null>(
    isExtinguisherType(object.typeCode) ? object.extinguisherProfile ?? emptyExtinguisherProfile(object.typeCode) : null,
  );
  const [roomId, setRoomId] = useState(object.roomId ?? '');
  const [note, setNote] = useState(object.note ?? '');

  useEffect(() => {
    setTypeCode(object.typeCode);
    setRegNumber(object.regNumber ?? '');
    setModel(object.model ?? '');
    setManufacturer(object.manufacturer ?? '');
    setManufacturerChoice(manufacturerChoiceFor(object.manufacturer));
    setSerialNumber(object.serialNumber ?? '');
    setCommissionedOn(object.commissionedOn ?? '');
    setServiceLife(serviceLifeYearsOf(object) === null ? '' : String(serviceLifeYearsOf(object)));
    setResponsible(object.responsible ?? '');
    setExtinguisherProfile(
      isExtinguisherType(object.typeCode) ? object.extinguisherProfile ?? emptyExtinguisherProfile(object.typeCode) : null,
    );
    // Карточка крана восстанавливается вместе с остальными полями: без этого
    // после перерисовки в форме оставались прежние значения, и следующее
    // сохранение возвращало их обратно поверх изменённых.
    setHydrantProfile(object.hydrantProfile ?? EMPTY_HYDRANT_PROFILE);
    setBarrierProfile(object.fireBarrierProfile ?? EMPTY_FIRE_BARRIER);
    setSuppressionProfile(object.suppressionProfile ?? EMPTY_SUPPRESSION);
    setControlPanelProfile(object.controlPanelProfile ?? EMPTY_CONTROL_PANEL);
    setOutdoorHydrantProfile(object.outdoorHydrantProfile ?? EMPTY_OUTDOOR_HYDRANT);
    setWaterSourceProfile(object.waterSourceProfile ?? EMPTY_WATER_SOURCE);
    setLadderProfile(object.ladderProfile ?? EMPTY_LADDER);
    setRoofFenceProfile(object.roofFenceProfile ?? EMPTY_ROOF_FENCE);
    setFireproofingProfile(object.fireproofingProfile ?? EMPTY_FIREPROOFING);
    setFireBoardProfile(object.fireBoardProfile ?? EMPTY_FIRE_BOARD);
    setPumpStationProfile(object.pumpStationProfile ?? EMPTY_PUMP_STATION);
    setCustomFields(object.customFields ?? {});
    setRoomId(object.roomId ?? '');
    setNote(object.note ?? '');
    props.onTypeDirtyChange(false);
  }, [object]);

  const extinguisher = isExtinguisherType(typeCode);
  /** У пожарного крана свой короткий набор полей (Дополнение 6). */
  const hydrant = typeCode === 'fire-hydrant-indoor';
  /** Противопожарная преграда: свой набор полей (Дополнение 6). */
  const barrier = typeCode === 'fire-door';
  /** Модульная автономная установка пожаротушения: свой набор полей. */
  const suppression = typeCode === 'autonomous-suppression' || typeCode.startsWith('suppression-');
  /**
   * Точка размещения комплекта: самоспасатели в одном шкафу (Дополнение 6).
   *
   * Учёт у них поштучный, и всё, что относится к отдельной штуке — номер,
   * марка, заводской номер, срок службы, — задаётся в перечне единиц ниже.
   * Здесь эти графы не показываются: одна и та же величина в двух местах
   * означала бы, что где-то она неверна, а где — неизвестно.
   */
  const placementHead = isMultiUnitType(typeCode) && (object.placementId ?? null) === null;
  /**
   * Прибор приёмно-контрольный — голова системы пожарной автоматики.
   *
   * Изготовителя и модель он выбирает из своего справочника, а не набирает
   * руками, и к обычным графам добавляются исполнение и резервное питание
   * (Дополнение 6).
   */
  const controlPanel = typeCode === SYSTEM_HEAD_TYPE;
  /**
   * Элемент системы пожарной автоматики (Дополнение 6).
   *
   * Изготовителя и дату постановки на учёт он берёт от своего прибора: их
   * ставит один монтажник в один день и одного изготовителя — адресный
   * протокол у каждого свой. Здесь эти графы показаны подставленными, а не
   * пустыми полями ввода: сорок карточек, заполняемых вручную, дают сорок
   * разных написаний.
   */
  const systemHost = systemOf(props.allObjects, object);
  /**
   * Элемент системы пожарной автоматики.
   *
   * Дату постановки на учёт берёт от прибора всё оборудование системы: её
   * проектируют, монтируют и сдают целиком, и у клапана дымоудаления та же дата
   * ввода, что у прибора.
   */
  const systemMember = systemHost !== null;
  /**
   * Берёт ли элемент от прибора ещё и изготовителя.
   *
   * Только оборудование адресной линии — ДИП, ИПР, СОУЭ: протокол линии у
   * каждого свой. У клапана, вентилятора и модуля пожаротушения изготовитель
   * свой, и графа у них обычная, заполняемая вручную.
   */
  const inheritingMember = systemMember && inheritsFromSystem(typeCode);
  /**
   * Пожарный извещатель: срок службы по паспорту у него не ведут.
   *
   * Обслуживают его в составе системы и по её регламенту, а меняют по отказу
   * или по результату проверки работоспособности, а не по календарю.
   */
  const detector = FIRE_DETECTOR_TYPES.includes(typeCode);
  /**
   * Наружный пожарный гидрант.
   *
   * Марку, изготовителя и заводской номер у него не ведут: в колодце его знают
   * по учётному номеру и по табличке-указателю, а паспорт остаётся у
   * водоканала (Дополнение 6).
   */
  const outdoorHydrant = typeCode === 'hydrant';
  /**
   * Пожарный водоисточник: водоём, резервуар, естественный источник.
   *
   * Марки, изготовителя и заводского номера у него нет — это сооружение, а не
   * изделие (Дополнение 6).
   */
  const waterSource = WATER_SOURCE_TYPES.includes(typeCode);
  /**
   * Наружная пожарная лестница.
   *
   * Марки и изготовителя у неё не ведут: её варят по проекту на месте, а не
   * покупают изделием (Дополнение 6).
   */
  const ladder = typeCode === 'outdoor-ladder';
  /**
   * Наружное оборудование со своим коротким набором граф (Дополнение 6).
   *
   * Ограждение кровли и пожарный щит — сооружения, а не изделия: марки и
   * изготовителя у них не ведут. У насосной станции они остаются: насосы
   * покупают, и марка нужна для подбора запчастей.
   */
  const roofFence = typeCode === 'roof-fence';
  const fireBoard = FIRE_BOARD_TYPES.includes(typeCode);
  const pumpStation = typeCode === 'pump-station';
  /**
   * Огнезащитная обработка — состояние конструкции, а не изделие.
   *
   * Ни марки с изготовителем изделия, ни заводского номера, ни срока службы по
   * паспорту: состав, дата обработки и срок её действия живут в своих графах.
   */
  const fireproofing = typeCode === 'fireproofing';
  // Свой вид элемента: описание его полей лежит в настройках (движок E4).
  const ownType = customElementByCode(typeCode);
  const assignedResponsible = responsibleFor(props.nodes, { ...object, responsible: null } as PlanObject);
  const manufacturerModels = extinguisher && manufacturerChoice !== '' && manufacturerChoice !== OTHER_MANUFACTURER
    ? extinguisherModelsForManufacturer(manufacturerChoice, typeCode)
    : [];
  // У элемента системы список моделей зависит от изготовителя: болидовский
  // извещатель с прибором «Рубежа» не заработает, и предлагать такую пару
  // нельзя (Дополнение 6).
  const models: readonly { code: string; title: string }[] = extinguisher
    ? manufacturerModels
    : systemMember
      ? automationModels(manufacturer, typeCode).map((model) => ({ code: model, title: model }))
      : modelsFor(typeCode);
  const reference = extinguisherReferenceByManufacturerAndModel(manufacturer, model);
  const family = familyOptionsFor(object.typeCode);
  /**
   * Бумаги, приложенные к проверкам этого элемента (Дополнение 6).
   *
   * У любого вида оборудования, а не только у огнетушителей: акт испытания
   * лестницы нужен ровно так же. Собираются в ядре из всех трёх мест, куда их
   * кладут в чек-листе, — акт проверки, акт подрядчика, вложения к пунктам.
   */
  const documents = maintenanceDocuments(object.id, props.events);
  const setExtinguisherProfileField = <K extends keyof ExtinguisherProfile>(key: K, value: ExtinguisherProfile[K]): void => {
    const profile = extinguisherProfile ?? emptyExtinguisherProfile(typeCode);
    setExtinguisherProfile({ ...profile, [key]: value });
  };
  const cardErrors = extinguisherCardErrors({
    typeCode, regNumber, model, manufacturer, serialNumber, commissionedOn, serviceLife, responsible, extinguisherProfile, hydrantProfile, barrierProfile, suppressionProfile,
  });
  const currentFields = (
    nextTypeCode = typeCode,
    nextProfile = extinguisherProfile,
    nextModel = model,
  ): ObjectFields => {
    const years = serviceLife.trim() === '' ? null : Number(serviceLife);
    const normalizedYears = years !== null && Number.isFinite(years) ? years : null;
    const baseProfile = nextProfile ?? emptyExtinguisherProfile(nextTypeCode);
    return {
      typeCode: nextTypeCode,
      regNumber: regNumber.trim() === '' ? null : regNumber,
      model: nextModel.trim() === '' ? null : nextModel,
      manufacturer: manufacturer.trim() === '' ? null : manufacturer,
      serialNumber: serialNumber.trim() === '' ? null : serialNumber,
      commissionedOn: commissionedOn.trim() === '' ? null : commissionedOn,
      serviceLifeYears: normalizedYears,
      responsible: responsible.trim() === '' ? null : responsible,
      hydrantProfile: typeCode === 'fire-hydrant-indoor' ? hydrantProfile : null,
      fireBarrierProfile: typeCode === 'fire-door' ? barrierProfile : null,
      suppressionProfile: nextTypeCode === 'autonomous-suppression' || nextTypeCode.startsWith('suppression-')
        ? suppressionProfile
        : null,
      controlPanelProfile: nextTypeCode === SYSTEM_HEAD_TYPE ? controlPanelProfile : null,
      outdoorHydrantProfile: nextTypeCode === 'hydrant' ? outdoorHydrantProfile : null,
      waterSourceProfile: WATER_SOURCE_TYPES.includes(nextTypeCode) ? waterSourceProfile : null,
      ladderProfile: nextTypeCode === 'outdoor-ladder' ? ladderProfile : null,
      roofFenceProfile: nextTypeCode === 'roof-fence' ? roofFenceProfile : null,
      fireproofingProfile: nextTypeCode === 'fireproofing' ? fireproofingProfile : null,
      fireBoardProfile: FIRE_BOARD_TYPES.includes(nextTypeCode) ? fireBoardProfile : null,
      pumpStationProfile: nextTypeCode === 'pump-station' ? pumpStationProfile : null,
      customFields: keepKnownFields(customElementByCode(nextTypeCode), customFields),
      extinguisherProfile: isExtinguisherType(nextTypeCode)
        ? {
          ...baseProfile,
          placedOn: commissionedOn.trim() === '' ? null : commissionedOn,
          serviceLifeEndsOn: serviceLifeEndsOn(baseProfile.manufacturedOn, normalizedYears),
        }
        : null,
      roomId: roomId === '' ? null : roomId,
      note: note.trim() === '' ? null : note,
    };
  };
  useEffect(() => {
    props.onDraftChange(currentFields());
  }, [typeCode, regNumber, model, manufacturer, serialNumber, commissionedOn, serviceLife, responsible, extinguisherProfile, hydrantProfile, barrierProfile, suppressionProfile, controlPanelProfile, outdoorHydrantProfile, waterSourceProfile, ladderProfile, roofFenceProfile, fireproofingProfile, fireBoardProfile, pumpStationProfile, customFields, roomId, note]);
  useEffect(() => {
    if (!extinguisher || reference?.serviceLifeYears == null) return;
    const next = String(reference.serviceLifeYears);
    if (serviceLife !== next) setServiceLife(next);
  }, [extinguisher, reference?.model, reference?.serviceLifeYears]);

  /*
   * Вещество и заряд подставляются из вида изделия и его модели.
   *
   * Заказчик: «нужно несколько раз вводить одни и те же данные, чтобы
   * определился ранг». К этим полям человек приходит, уже дважды сказав то
   * же самое: видом «Огнетушитель порошковый» и моделью «ОП-4».
   *
   * Подставляется только пустое: вписанное человеком главнее — огнетушитель
   * бывает перезаряжен другим составом. Что именно вытекает из вида и
   * модели, решает ядро, а не форма: то же правило нужно при переносе
   * журнала из старой таблицы.
   */
  useEffect(() => {
    if (!extinguisher) return;
    const filled = impliedProfileFields({
      typeCode, model: model.trim() === '' ? null : model, profile: extinguisherProfile,
    });
    if (Object.keys(filled).length === 0) return;
    setExtinguisherProfile({ ...(extinguisherProfile ?? emptyExtinguisherProfile(typeCode)), ...filled });
  }, [extinguisher, typeCode, model, extinguisherProfile]);
  useEffect(() => {
    if (!extinguisher || extinguisherProfile === null) return;
    const years = serviceLife.trim() === '' ? null : Number(serviceLife);
    const next = serviceLifeEndsOn(
      extinguisherProfile.manufacturedOn,
      years !== null && Number.isFinite(years) ? years : null,
    );
    if (extinguisherProfile.serviceLifeEndsOn !== next) {
      setExtinguisherProfile({ ...extinguisherProfile, serviceLifeEndsOn: next });
    }
  }, [extinguisher, extinguisherProfile?.manufacturedOn, extinguisherProfile?.serviceLifeEndsOn, serviceLife]);
  /**
   * Нарушения логики данных для того, что сейчас в форме (Дополнение 7).
   *
   * Считаются по черновику, а не по сохранённому объекту: пользователь должен
   * увидеть противоречие сразу при вводе, а не после нажатия «Сохранить».
   */
  const problems = objectProblems(
    { ...object, ...currentFields(), hydrantProfile } as PlanObject,
    { nodes: props.nodes, objects: props.allObjects, today: todayIso(), rooms: props.rooms },
  );
  const bans = blocking(problems);
  const notices = warnings(problems);

  const save = (): void => props.onSave(currentFields());

  return <>
    {!placementHead && <label className="field"><span>Учётный номер</span><input value={regNumber} onChange={(event) => setRegNumber(event.target.value)} placeholder="28-27" /></label>}
    {family !== null && <label className="field">
      <span>{family.label}</span>
      <SelectField
        value={typeCode}
        options={family.options.map((option) => ({
          value: option.code, title: option.title, group: option.group,
        }))}
        onChange={(nextType) => {
        const manufacturerStillAllowed = manufacturerChoice === ''
          || manufacturerChoice === OTHER_MANUFACTURER
          || extinguisherManufacturersForType(nextType).some((option) => option.id === manufacturerChoice);
        let nextProfile: ExtinguisherProfile | null = extinguisherProfile;
        setTypeCode(nextType);
        if (isExtinguisherType(nextType) && extinguisherProfile === null) {
          nextProfile = emptyExtinguisherProfile(nextType);
          setExtinguisherProfile(nextProfile);
        }
        props.onTypeDirtyChange(nextType !== object.typeCode);
        const nextModel = manufacturerStillAllowed && modelIsAllowedFor(nextType, manufacturerChoice, model) ? model : '';
        props.onTypeSelected(currentFields(nextType, nextProfile, nextModel));
        if (nextModel === '') setModel('');
        if (!manufacturerStillAllowed) {
          setManufacturerChoice('');
          setManufacturer('');
          setServiceLife('');
        }
        }}
      />
    </label>}
    {barrier && <FireBarrierFields value={barrierProfile} onChange={setBarrierProfile} />}
    {outdoorHydrant && <OutdoorHydrantFields value={outdoorHydrantProfile} onChange={setOutdoorHydrantProfile} />}
    {waterSource && <WaterSourceFields value={waterSourceProfile} onChange={setWaterSourceProfile} />}
    {ladder && <LadderFields value={ladderProfile} onChange={setLadderProfile} />}
    {roofFence && <RoofFenceFields value={roofFenceProfile} onChange={setRoofFenceProfile} />}
    {fireBoard && <FireBoardFields value={fireBoardProfile} onChange={setFireBoardProfile} />}
    {pumpStation && <PumpStationFields value={pumpStationProfile} onChange={setPumpStationProfile} />}
    {fireproofing && <FireproofingFields value={fireproofingProfile} onChange={setFireproofingProfile} />}
    {/* Поля своего вида: их состав задан в настройках, а не в коде формы. */}
    {ownType !== null && <CustomFields type={ownType} values={customFields} onChange={setCustomFields} />}
    {controlPanel && <ControlPanelFields
      value={controlPanelProfile}
      onChange={setControlPanelProfile}
      manufacturer={manufacturer}
      model={model}
      onManufacturerChange={setManufacturer}
      onModelChange={setModel}
    />}
    {extinguisher && <ComboField
      label="Изготовитель"
      value={manufacturer === '' ? null : manufacturer}
      options={extinguisherManufacturersForType(typeCode).map((option) => option.name)}
      placeholder="выберите или введите своего"
      onChange={(value) => {
        const name = value ?? '';
        if (name === manufacturer) return;
        // Смена изготовителя обнуляет модель и срок службы: они взяты из его
        // справочника, и у другого изготовителя означали бы чужое изделие.
        setManufacturer(name);
        setManufacturerChoice(manufacturerChoiceFor(name === '' ? null : name));
        setModel('');
        setServiceLife('');
      }}
    />}
    {/* Изготовитель элемента системы подставлен от прибора: адресный протокол
        у каждого свой, и чужой извещатель с прибором не заработает. Своего
        вводят в том же поле — бывает, что оповещатели ставят стороннего. */}
    {inheritingMember && <ComboField
      label="Изготовитель"
      value={manufacturer === '' ? null : manufacturer}
      options={AUTOMATION_MANUFACTURERS.map((item) => item.name)}
      hint={manufacturer === (systemHost?.manufacturer ?? '')
        ? 'Подставляется от прибора системы. Сменится там — сменится и здесь, пока не указан свой.'
        : 'Указан свой изготовитель: от прибора он больше не подставляется.'}
      onChange={(value) => {
        if ((value ?? '') === manufacturer) return;
        setManufacturer(value ?? '');
        setModel('');
      }}
    />}
    {/* У пожарного крана марки и модели не ведут: на объекте его знают по
        учётному номеру и характеристикам клапана и рукава. */}
    {!hydrant && !placementHead && !controlPanel && !outdoorHydrant && !waterSource && !ladder && !roofFence && !fireBoard && !fireproofing && <ComboField
      label="Марка, модель"
      value={model === '' ? null : model}
      options={models.map((option) => option.code)}
      /*
       * Поле не запирается.
       *
       * Раньше у огнетушителя оно было недоступно, пока не выбран
       * изготовитель: в списке нечего показывать. Но заказчик прав — «поле
       * визуально отображается как редактируемое, а курсор в него не
       * поставить». Марку пишут и от руки: изделия бывают не из справочника,
       * и заставлять человека сперва искать изготовителя незачем.
       *
       * Список подсказок при этом остаётся пустым до выбора изготовителя —
       * подсказывать нечего, а вписать своё можно всегда.
       */
      placeholder={extinguisher && manufacturer === '' ? 'впишите марку или укажите изготовителя для списка' : 'выберите или введите свою'}
      onChange={(value) => {
        const next = value ?? '';
        setModel(next);
        // Срок службы известен только для моделей справочника: у своей его
        // подставлять неоткуда, и прежний остался бы от чужого изделия.
        const reference = extinguisherReferenceByManufacturerAndModel(manufacturer, next);
        setServiceLife(reference?.serviceLifeYears == null ? '' : String(reference.serviceLifeYears));
        /*
         * Заряд записан в самом обозначении модели: «ОП-4» — это четыре
         * килограмма порошка. Сменили модель — сменился и заряд.
         *
         * Читается тем же правилом ядра, что и при открытии карточки, а не
         * полем справочника: у своей модели, набранной руками, поля
         * справочника нет, а обозначение читается точно так же.
         */
        const charge = chargeFromModel(next);
        if (charge !== null) setExtinguisherProfileField('nominalCharge', charge);
      }}
    />}
    {reference != null && (
      <ManufacturerLinks
        officialUrl={reference.officialUrl ?? null}
        passportUrl={reference.passportUrl ?? null}
      />
    )}
    {!hydrant && !placementHead && !outdoorHydrant && !waterSource && !fireproofing && <div className="field-row">
      {!extinguisher && !controlPanel && !inheritingMember && !ladder && !roofFence && !fireBoard && <label className="field"><span>Изготовитель</span><input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder="АО «Пожтехника»" /></label>}
      <label className="field"><span>Заводской №</span><input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="CO2-24001567" /></label>
    </div>}
    {systemMember && <label className="field"><span>Дата постановки на учёт / размещения</span>
      {/* Подставлена от прибора: систему монтируют и сдают целиком, и сорок
          дат, набранных вручную, разойдутся между собой (Дополнение 6). */}
      <output className="readonly-field">{commissionedOn === '' ? 'не указана' : formatDateRu(commissionedOn)}</output>
    </label>}
    {systemMember && (
      <p className="muted small">Подставляется от прибора: систему проектируют, монтируют и сдают целиком.</p>
    )}
    {!placementHead && !systemMember && !fireproofing && <div className="field-row">
      <label className="field"><span>Дата постановки на учёт / размещения</span><input type="date" title="Пример: 15.03.2026" value={commissionedOn} onChange={(event) => setCommissionedOn(event.target.value)} /></label>
      {isExtinguisherType(typeCode) && (
        <DateField label="Дата изготовления" value={extinguisherProfile?.manufacturedOn ?? null} onChange={(value) => setExtinguisherProfileField('manufacturedOn', value)} />
      )}
    </div>}
    {!hydrant && !placementHead && !detector && !waterSource && !roofFence && !fireBoard && !fireproofing && <label className="field"><span>Срок службы по паспорту, лет</span><input inputMode="numeric" value={serviceLife} onChange={(event) => setServiceLife(event.target.value)} placeholder={reference?.serviceLifeYears == null ? 'не указан' : `${reference.serviceLifeYears} лет`} /></label>}
    {extinguisher && <p className="muted small">Дата окончания срока службы рассчитывается от даты изготовления. Если изготовитель или модель выбраны вне справочника, срок можно указать вручную.</p>}
    {/*
      * Вид ОТВ, заряд и исполнение — то, что человек переписывает с этикетки.
      * Ранг тушения из них считается сам: вводить его руками не нужно.
      */}
    {extinguisher && extinguisherProfile !== null && (
      <ExtinguisherRankFields
        typeCode={typeCode}
        model={model.trim() === '' ? null : model}
        value={extinguisherProfile}
        onChange={setExtinguisherProfileField}
      />
    )}
    {hydrant && <HydrantProfileFields value={hydrantProfile} onChange={setHydrantProfile} />}
    {waterSource && <WaterSourceSign
      value={waterSourceProfile}
      regNumber={regNumber.trim() === '' ? null : regNumber}
    />}
    {outdoorHydrant && <HydrantSign
      value={outdoorHydrantProfile}
      regNumber={regNumber.trim() === '' ? null : regNumber}
      busy={props.busy}
      onChange={setOutdoorHydrantProfile}
    />}
    <label className="field"><span>Ответственный</span>
      <output className="readonly-field">{assignedResponsible ?? 'не назначен'}</output>
    </label>
    <p className="muted small">
      {assignedResponsible === null
        ? 'Ответственный назначается в профиле здания — там же он подставится сюда и в журнал.'
        : 'Подставляется из профиля здания. Сменится там — сменится во всех карточках сразу.'}
    </p>
    {props.rooms.length > 0 && (
      <SelectField
        label="Помещение"
        value={roomId}
        placeholder="не указано"
        options={props.rooms.map((room) => ({
          value: room.id,
          title: `${room.name}${room.number === null ? '' : ` (№ ${room.number})`}`,
        }))}
        onChange={setRoomId}
      />
    )}
    {suppression && <SuppressionFields value={suppressionProfile} onChange={setSuppressionProfile} />}
    {props.beforeNote}
    <label className="field"><span>Примечание</span><input value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {cardErrors.length > 0 && <div className="validation-summary"><strong>Обязательные поля карточки:</strong><ul>{cardErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {/* Запреты и предупреждения логики данных (Дополнение 7). Запрет не даёт
        сохранить, предупреждение — только предупреждает: решает человек. */}
    {bans.length > 0 && <div className="validation-summary error"><strong>Так сохранить нельзя:</strong><ul>{bans.map((item) => <li key={item.message}>{item.message}</li>)}</ul></div>}
    {notices.length > 0 && <div className="validation-summary warn"><strong>Проверьте:</strong><ul>{notices.map((item) => <li key={item.message}>{item.message}</li>)}</ul></div>}
    <div className="actions"><button type="button" className="primary" disabled={props.busy || bans.length > 0} onClick={save}>Сохранить</button></div>

    {/* Документы стоят под кнопкой: они не заполняются здесь, а появляются
        сами после проверки. Выше им место только мешало бы — там то, что
        человек вводит руками. */}
    <section className="object-documents">
      <h4>Документы по обслуживанию</h4>
      {documents.length === 0 ? (
        <p className="muted small">
          Акты, протоколы и снимки появятся здесь сами, как только их приложат в чек-листе проверки.
        </p>
      ) : (
        <ul>
          {documents.map((item) => (
            <li key={`${item.eventId}-${item.document.hash}`}>
              <span className="muted small">{formatDateRu(item.performedOn)}, {item.title}: </span>
              <StoredDocumentActions document={item.document} />
            </li>
          ))}
        </ul>
      )}
    </section>
  </>;
}

function DateField(props: { readonly label: string; readonly value: string | null; readonly onChange: (value: string | null) => void }): React.JSX.Element {
  return <label className="field"><span>{props.label}</span><input type="date" title="Пример: 15.03.2026" value={props.value ?? ''} onChange={(event) => props.onChange(event.target.value || null)} /></label>;
}

interface CardDraft {
  readonly typeCode: string; readonly regNumber: string; readonly model: string;
  readonly manufacturer: string; readonly serialNumber: string; readonly commissionedOn: string; readonly serviceLife: string;
  readonly responsible: string; readonly extinguisherProfile: ExtinguisherProfile | null;
  readonly hydrantProfile?: HydrantProfile | null;
  readonly barrierProfile?: FireBarrierProfile | null;
  readonly suppressionProfile?: SuppressionProfile | null;
}

function extinguisherCardErrors(draft: CardDraft): readonly string[] {
  if (!isExtinguisherType(draft.typeCode)) return [];
  const profile = draft.extinguisherProfile;
  const checks: readonly [boolean, string][] = [
    [draft.regNumber.trim() !== '', 'Укажите учётный номер'],
    [draft.model.trim() !== '', 'Укажите тип/модель'],
    [draft.manufacturer.trim() !== '', 'Укажите изготовителя'],
    [draft.serialNumber.trim() !== '', 'Укажите заводской номер'],
    [draft.commissionedOn.trim() !== '', 'Укажите дату размещения'],
    [profile?.manufacturedOn != null, 'Укажите дату изготовления'],
    [draft.serviceLife.trim() !== '', 'Укажите срок службы'],
    [draft.responsible.trim() !== '', 'Укажите ответственное лицо'],
  ];
  return checks.flatMap(([ok, message]) => ok ? [] : [message]);
}


const OTHER_MANUFACTURER = '__other__';

function manufacturerChoiceFor(manufacturer: string | null): string {
  if (manufacturer === null || manufacturer.trim() === '') return '';
  const found = extinguisherManufacturersForType('extinguisher').find((option) => option.name === manufacturer);
  return found?.id ?? OTHER_MANUFACTURER;
}

function modelIsAllowedFor(typeCode: string, manufacturerChoice: string, model: string): boolean {
  if (model.trim() === '') return true;
  if (manufacturerChoice === '' || manufacturerChoice === OTHER_MANUFACTURER) return false;
  return extinguisherModelsForManufacturer(manufacturerChoice, typeCode).some((option) => option.code === model);
}

