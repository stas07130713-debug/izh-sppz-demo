/**
 * Всё, что нужно сценарию проведения мероприятия.
 *
 * Объекты нужны, чтобы проверить, что мероприятие применимо к типу объекта, а
 * не подставлено по ошибке из чужого пакета правил.
 */

import type { Clock, IdGenerator, MaintenanceEventRepository, PlanObjectRepository } from '@izh/contracts';
import type { ActivityScheduleSource } from './activity-source.js';

export interface MaintenanceDeps {
  readonly events: MaintenanceEventRepository;
  readonly objects: PlanObjectRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /**
   * Откуда брать перечень применимых работ при проверке (Дополнение 5, Р19).
   *
   * Не задан — берётся нормативная библиотека. Задать его обязательно там, где
   * организация завела свой регламент: иначе сценарий отклонит собственную же
   * работу организации как «не применимую к этому типу оборудования».
   */
  readonly activities?: ActivityScheduleSource;
}
