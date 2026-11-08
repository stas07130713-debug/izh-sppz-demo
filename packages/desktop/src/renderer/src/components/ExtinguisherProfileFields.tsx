import type { ExtinguisherAgent, ExtinguisherProfile } from '@izh/contracts';
import { SelectField } from './SelectField';

interface ExtinguisherProfileFieldsProps {
  readonly value: ExtinguisherProfile;
  readonly onChange: (value: ExtinguisherProfile) => void;
}

const AGENTS: readonly ExtinguisherAgent[] = [
  'вода', 'вода с добавками', 'пена', 'порошок', 'углекислота', 'хладон', 'другое',
];

export function emptyExtinguisherProfile(typeCode: string): ExtinguisherProfile {
  const agentByType: Readonly<Record<string, ExtinguisherAgent>> = {
    'extinguisher-water': 'вода',
    'extinguisher-foam': 'пена',
    'extinguisher-emulsion': 'вода с добавками',
    'extinguisher-powder': 'порошок',
    'extinguisher-co2': 'углекислота',
    'extinguisher-halon': 'хладон',
    'extinguisher-bantl': 'вода с добавками',
  };
  return {
    placedOn: null, installationPoint: null, manufacturedOn: null,
    lastRechargeOn: null, nextAnnualCheckOn: null, nextWeighingOn: null,
    nextCylinderTestOn: null, serviceLifeEndsOn: null,
    responsiblePosition: null, responsibleOrganization: null,
    agent: agentByType[typeCode] ?? null, propulsion: null, execution: null,
    nominalCharge: null, chargeUnit: null, tareMassKg: null, nominalFullMassKg: null,
    nominalPressureMpa: null, pressureMinMpa: null, pressureMaxMpa: null,
    temperatureMinC: null, temperatureMaxC: null, fireClasses: [], fireRating: null,
    certificateNumber: null, passportFile: null, bodyMaterial: null, innerCoating: null,
    stabilizedMulticomponentCharge: false, adverseConditions: [],
  };
}

function numberOrNull(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
}

export function ExtinguisherProfileFields(props: ExtinguisherProfileFieldsProps): React.JSX.Element {
  const p = props.value;
  const set = <K extends keyof ExtinguisherProfile>(key: K, value: ExtinguisherProfile[K]): void => {
    props.onChange({ ...p, [key]: value });
  };

  return <section className="extinguisher-profile">
    <h4>Карточка огнетушителя по ГОСТ Р 59641-2021</h4>
    <div className="field-row">
      <DateField label="Дата размещения" value={p.placedOn} onChange={(v) => set('placedOn', v)} />
      <DateField label="Дата изготовления" value={p.manufacturedOn} onChange={(v) => set('manufacturedOn', v)} />
    </div>
    <label className="field"><span>Точная точка установки</span>
      <input value={p.installationPoint ?? ''} onChange={(e) => set('installationPoint', e.target.value || null)} placeholder="Коридор, у выхода № 3" />
    </label>
    <div className="field-row">
      <SelectField
        label="Огнетушащее вещество"
        value={p.agent ?? ''}
        placeholder="не выбрано"
        options={AGENTS.map((v) => ({ value: v, title: v }))}
        onChange={(value) => set('agent', value === '' ? null : value as ExtinguisherAgent)}
      />
      <SelectField
              label="Исполнение"
              value={p.execution ?? ''}
              options={[{ value: 'переносной', title: 'переносной' }, { value: 'передвижной', title: 'передвижной' }]}
              placeholder="не выбрано"
              onChange={(v) => set('execution', v === '' ? null : v as ExtinguisherProfile['execution'])}
            />
    </div>
    <SelectField
              label="Способ создания давления"
              value={p.propulsion ?? ''}
              options={[{ value: 'закачной', title: 'закачной' }, { value: 'баллон вытесняющего газа', title: 'баллон вытесняющего газа' }, { value: 'газогенерирующее устройство', title: 'газогенерирующее устройство' }, { value: 'газовый', title: 'газовый' }, { value: 'другое', title: 'другое' }]}
              placeholder="не выбрано"
              onChange={(v) => set('propulsion', v === '' ? null : v as ExtinguisherProfile['propulsion'])}
            />
    <div className="field-row">
      <NumberField label="Номинальный заряд" value={p.nominalCharge} onChange={(v) => set('nominalCharge', v)} />
      <SelectField
              label="Единица заряда"
              value={p.chargeUnit ?? ''}
              options={[{ value: 'кг', title: 'кг' }, { value: 'л', title: 'л' }]}
              placeholder="—"
              onChange={(v) => set('chargeUnit', v === '' ? null : v as 'кг' | 'л')}
            />
    </div>
    <div className="field-row">
      <NumberField label="Конструкционная масса, кг" value={p.tareMassKg} onChange={(v) => set('tareMassKg', v)} />
      <NumberField label="Полная масса, кг" value={p.nominalFullMassKg} onChange={(v) => set('nominalFullMassKg', v)} />
    </div>
    <div className="field-row">
      <NumberField label="Рабочее давление, МПа" value={p.nominalPressureMpa} onChange={(v) => set('nominalPressureMpa', v)} />
      <NumberField label="Мин. давление, МПа" value={p.pressureMinMpa} onChange={(v) => set('pressureMinMpa', v)} />
      <NumberField label="Макс. давление, МПа" value={p.pressureMaxMpa} onChange={(v) => set('pressureMaxMpa', v)} />
    </div>
    <div className="field-row">
      <NumberField label="Мин. температура, °C" value={p.temperatureMinC} onChange={(v) => set('temperatureMinC', v)} />
      <NumberField label="Макс. температура, °C" value={p.temperatureMaxC} onChange={(v) => set('temperatureMaxC', v)} />
    </div>
    <div className="field-row">
      <DateField label="Следующая годовая проверка" value={p.nextAnnualCheckOn} onChange={(v) => set('nextAnnualCheckOn', v)} />
      <DateField label="Дата последней перезарядки" value={p.lastRechargeOn} onChange={(v) => set('lastRechargeOn', v)} />
    </div>
    <div className="field-row">
      <DateField label="Следующее взвешивание" value={p.nextWeighingOn} onChange={(v) => set('nextWeighingOn', v)} />
      <DateField label="Следующее испытание корпуса" value={p.nextCylinderTestOn} onChange={(v) => set('nextCylinderTestOn', v)} />
    </div>
    <DateField label="Окончание срока службы" value={p.serviceLifeEndsOn} onChange={(v) => set('serviceLifeEndsOn', v)} />
    <div className="field-row">
      <label className="field"><span>Должность ответственного</span><input value={p.responsiblePosition ?? ''} onChange={(e) => set('responsiblePosition', e.target.value || null)} placeholder="Инженер по ПБ" /></label>
      <label className="field"><span>Организация ответственного</span><input value={p.responsibleOrganization ?? ''} onChange={(e) => set('responsibleOrganization', e.target.value || null)} placeholder="ООО «Пример»" /></label>
    </div>
    <div className="field-row">
      <label className="field"><span>Классы пожаров</span><input value={p.fireClasses.join(', ')} onChange={(e) => set('fireClasses', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))} placeholder="A, B, C, E" /></label>
      <label className="field"><span>Ранг тушения</span><input value={p.fireRating ?? ''} onChange={(e) => set('fireRating', e.target.value || null)} placeholder="2A, 55B" /></label>
    </div>
    <label className="field"><span>Сертификат соответствия</span><input value={p.certificateNumber ?? ''} onChange={(e) => set('certificateNumber', e.target.value || null)} placeholder="ЕАЭС RU C-RU.ПБ00.В.01234/24" /></label>
    <div className="field-row">
      <SelectField
              label="Материал корпуса"
              value={p.bodyMaterial ?? ''}
              options={[{ value: 'сталь', title: 'сталь' }, { value: 'нержавеющая сталь', title: 'нержавеющая сталь' }, { value: 'другое', title: 'другое' }]}
              placeholder="не выбрано"
              onChange={(v) => set('bodyMaterial', v === '' ? null : v as ExtinguisherProfile['bodyMaterial'])}
            />
      <SelectField
              label="Внутреннее покрытие"
              value={p.innerCoating ?? ''}
              options={[{ value: 'нет', title: 'нет' }, { value: 'полимерное', title: 'полимерное' }, { value: 'эпоксидное', title: 'эпоксидное' }, { value: 'другое', title: 'другое' }]}
              placeholder="не выбрано"
              onChange={(v) => set('innerCoating', v === '' ? null : v as ExtinguisherProfile['innerCoating'])}
            />
    </div>
    <label className="checkbox"><input type="checkbox" checked={p.stabilizedMulticomponentCharge} onChange={(e) => set('stabilizedMulticomponentCharge', e.target.checked)} /><span>Стабилизированный многокомпонентный заряд — срок по паспорту</span></label>
    <fieldset className="field"><legend>Неблагоприятные условия эксплуатации</legend>
      {['категория А', 'влажность более 90%', 'коррозионная среда', 'вибрация', 'температура близка к предельной'].map((condition) =>
        <label className="checkbox" key={condition}><input type="checkbox" checked={p.adverseConditions.includes(condition)} onChange={() => set('adverseConditions', p.adverseConditions.includes(condition) ? p.adverseConditions.filter((v) => v !== condition) : [...p.adverseConditions, condition])} /><span>{condition}</span></label>)}
    </fieldset>
  </section>;
}

function DateField(props: { label: string; value: string | null; onChange: (value: string | null) => void }): React.JSX.Element {
  return <label className="field"><span>{props.label}</span><input type="date" title="Пример: 15.03.2026" value={props.value ?? ''} onChange={(e) => props.onChange(e.target.value || null)} /></label>;
}

function NumberField(props: { label: string; value: number | null; onChange: (value: number | null) => void }): React.JSX.Element {
  return <label className="field"><span>{props.label}</span><input inputMode="decimal" placeholder="например, 5,0" value={props.value ?? ''} onChange={(e) => props.onChange(numberOrNull(e.target.value))} /></label>;
}
