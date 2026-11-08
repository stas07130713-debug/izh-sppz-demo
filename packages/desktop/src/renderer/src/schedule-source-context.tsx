/**
 * Действующий источник правил обслуживания — один на всё окно программы.
 *
 * Состояние объекта считают семь мест: журнал, план, дашборд, склад, карточка,
 * правая панель и фильтр. Все семь обязаны получить один и тот же ответ, иначе
 * один и тот же кран в журнале «просрочен», а на плане «в норме» — и веры
 * программе не будет.
 *
 * Поэтому источник берётся из общего контекста, а не собирается на месте:
 * протаскивать его отдельным свойством через семь уровней разметки значило бы
 * оставить семь возможностей забыть.
 *
 * Значение по умолчанию — нормативная библиотека: если провайдер почему-то не
 * обёрнут, программа посчитает как до конструктора регламентов, а не упадёт.
 */

import { createContext, useContext } from 'react';
import { rulePackageSource, type ActivityScheduleSource } from '@izh/core';

const ScheduleSourceContext = createContext<ActivityScheduleSource>(rulePackageSource);

export function ScheduleSourceProvider(props: {
  readonly value: ActivityScheduleSource;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <ScheduleSourceContext.Provider value={props.value}>{props.children}</ScheduleSourceContext.Provider>;
}

export function useScheduleSource(): ActivityScheduleSource {
  return useContext(ScheduleSourceContext);
}
