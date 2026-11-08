/**
 * Какой блок дашборда чем рисуется (ТЗ, Дополнение 6, части С50, С99).
 *
 * Только соответствие «название блока → его вид». Сами виды живут рядом:
 * плитки в `dashboard-tiles`, графики и полосы в `dashboard-charts`, списки и
 * таблицы в `dashboard-lists`. Держать их в одном файле значило бы получить
 * файл, в котором не найти ни одного блока.
 */

import {
  GroupsCard, PlacesCard, StatusDonut, SystemsDonut, TrendCard,
} from './dashboard-charts';
import { KindDonuts } from './dashboard-kind-donuts';
import { ServiceHorizons } from './dashboard-service';
import {
  BrokenCard, OverdueCard, ProblemTypesCard, SystemsCard, TypesCard, UpcomingCard,
} from './dashboard-lists';
import type { BlockContext } from './dashboard-context';

export { tileFor, Tile } from './dashboard-tiles';
export type { BlockContext } from './dashboard-context';

/** График, полоса, список или таблица — всё, что рисуется ниже верхнего ряда. */
export function cardFor(id: string, context: BlockContext): React.JSX.Element | null {
  switch (id) {
    case 'график-состояние': return <StatusDonut key={id} context={context} />;
    case 'график-системы': return <SystemsDonut key={id} context={context} />;
    case 'график-по-видам': return <KindDonuts key={id} context={context} />;
    case 'график-динамика': return <TrendCard key={id} context={context} />;
    case 'график-разделы': return <GroupsCard key={id} context={context} />;
    case 'график-виды': return <TypesCard key={id} context={context} />;
    case 'список-проблемные': return <ProblemTypesCard key={id} context={context} />;
    case 'список-места': return <PlacesCard key={id} context={context} />;
    case 'список-просрочено': return <OverdueCard key={id} context={context} />;
    case 'список-работы-7': return <UpcomingCard key={id} context={context} days={7} />;
    case 'список-работы-30': return <UpcomingCard key={id} context={context} days={30} />;
    case 'список-неисправности': return <BrokenCard key={id} context={context} />;
    case 'список-системы': return <SystemsCard key={id} context={context} />;
    case 'сроки-то': return <ServiceHorizons key={id} context={context} />;
    default: return null;
  }
}
