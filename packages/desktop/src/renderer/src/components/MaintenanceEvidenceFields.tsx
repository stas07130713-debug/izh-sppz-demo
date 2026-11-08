import type { ExternalMaintenanceEvidence, MaintenanceExecutor, StoredDocumentReference } from '@izh/contracts';

export interface MaintenanceEvidenceState {
  readonly external: boolean;
  readonly fullName: string;
  readonly position: string;
  readonly executorOrganization: string;
  readonly externalOrganization: string;
  readonly inn: string;
  readonly licenseNumber: string;
  readonly actNumber: string;
  readonly actDate: string;
  readonly actFile: StoredDocumentReference | null;
}

interface MaintenanceEvidenceFieldsProps {
  readonly value: MaintenanceEvidenceState;
  readonly onChange: (value: MaintenanceEvidenceState) => void;
  readonly onError: (message: string) => void;
}

export function executorFrom(state: MaintenanceEvidenceState): MaintenanceExecutor | null {
  if (state.external) return state.fullName.trim() === '' || state.position.trim() === '' ? null : {
    fullName: state.fullName.trim(), position: state.position.trim(), organization: state.externalOrganization.trim(),
  };
  return state.fullName.trim() === '' || state.position.trim() === '' || state.executorOrganization.trim() === ''
    ? null
    : { fullName: state.fullName.trim(), position: state.position.trim(), organization: state.executorOrganization.trim() };
}

export function externalEvidenceFrom(state: MaintenanceEvidenceState): ExternalMaintenanceEvidence | null {
  if (!state.external || state.actFile === null) return null;
  return {
    organization: state.externalOrganization.trim(), inn: state.inn.trim(), licenseNumber: state.licenseNumber.trim(),
    actNumber: state.actNumber.trim(), actDate: state.actDate, actFile: state.actFile,
  };
}

export function evidenceErrors(state: MaintenanceEvidenceState): readonly string[] {
  const errors: string[] = [];
  if (!state.external) {
    if (state.fullName.trim() === '') errors.push('Не указано Ф.И.О. исполнителя');
    if (state.position.trim() === '') errors.push('Не указана должность исполнителя');
    if (state.executorOrganization.trim() === '') errors.push('Не указана организация исполнителя');
    return errors;
  }
  if (state.externalOrganization.trim() === '') errors.push('Не указана сторонняя организация');
  if (state.inn.trim() === '') errors.push('Не указан ИНН сторонней организации');
  if (state.actNumber.trim() === '') errors.push('Не указан номер акта');
  if (state.actDate === '') errors.push('Не указана дата акта');
  if (state.actFile === null) errors.push('Не загружен акт выполненных работ');
  return errors;
}

export function MaintenanceEvidenceFields(props: MaintenanceEvidenceFieldsProps): React.JSX.Element {
  const v = props.value;
  const set = (values: Partial<MaintenanceEvidenceState>): void => props.onChange({ ...v, ...values });
  const pickAct = async (): Promise<void> => {
    const picked = await window.izh.openMaintenanceDocument();
    if (!picked.ok) { props.onError(picked.error.message); return; }
    if (picked.value === null) return;
    const extension = picked.value.fileName.includes('.') ? picked.value.fileName.split('.').pop() ?? 'bin' : 'bin';
    const stored = await window.izh.store.put(picked.value.bytes, extension);
    if (!stored.ok) { props.onError(stored.error.message); return; }
    set({ actFile: { hash: stored.value, fileName: picked.value.fileName } });
  };

  /*
   * Кто выполнял работы — выбор из двух, а не галочка сбоку.
   *
   * Заказчик: «сейчас визуально галочка "выполнено сторонней организацией" и
   * заполненная графа с ФИО как бы в одном блоке; нужно, чтобы это визуально
   * разделялось — либо-либо».
   *
   * И правда: галочка стояла над полями исполнителя, и выглядело это так,
   * будто её ставят **вместе** с ФИО, а не вместо. Теперь два переключателя
   * рядом, а поля выбранного варианта — в своей рамке под ним: видно, что
   * заполняется ровно один из двух наборов.
   */
  return <section className="maintenance-evidence">
    <div className="evidence-switch" role="radiogroup" aria-label="Кто выполнял работы">
      <button
        type="button"
        role="radio"
        aria-checked={!v.external}
        className={v.external ? 'evidence-choice' : 'evidence-choice selected'}
        onClick={() => set({ external: false })}
      >Своими силами</button>
      <button
        type="button"
        role="radio"
        aria-checked={v.external}
        className={v.external ? 'evidence-choice selected' : 'evidence-choice'}
        onClick={() => set({ external: true })}
      >Сторонней организацией</button>
    </div>
    {!v.external ? <div className="evidence-block"><div className="field-row">
      <label className="field"><span>Ф.И.О. исполнителя</span><input value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Иванов Иван Иванович" /></label>
      <label className="field"><span>Должность</span><input value={v.position} onChange={(e) => set({ position: e.target.value })} placeholder="Инженер по ПБ" /></label>
      <label className="field"><span>Организация</span><input value={v.executorOrganization} onChange={(e) => set({ executorOrganization: e.target.value })} placeholder="ООО «Пример»" /></label>
    </div></div> : <div className="evidence-block">
      <div className="field-row">
        <label className="field"><span>Сторонняя организация</span><input value={v.externalOrganization} onChange={(e) => set({ externalOrganization: e.target.value })} /></label>
        <label className="field"><span>ИНН</span><input value={v.inn} onChange={(e) => set({ inn: e.target.value })} /></label>
        <label className="field"><span>Лицензия (при наличии / если требуется)</span><input value={v.licenseNumber} onChange={(e) => set({ licenseNumber: e.target.value })} /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Номер акта</span><input value={v.actNumber} onChange={(e) => set({ actNumber: e.target.value })} /></label>
        <label className="field"><span>Дата акта</span><input type="date" value={v.actDate} onChange={(e) => set({ actDate: e.target.value })} /></label>
      </div>
      <div className="document-picker"><button type="button" onClick={() => void pickAct()}>Загрузить акт</button><span className="muted small">{v.actFile?.fileName ?? 'акт не загружен'}</span></div>
      <details><summary className="small">Исполнитель, указанный в акте</summary><div className="field-row">
        <label className="field"><span>Ф.И.О.</span><input value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} /></label>
        <label className="field"><span>Должность</span><input value={v.position} onChange={(e) => set({ position: e.target.value })} /></label>
      </div></details>
    </div>}
  </section>;
}
