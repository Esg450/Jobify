/** The cards on the dashboard. Users can reorder and hide them; the order here is the default. */
export const DASHBOARD_CARDS = [
  'active',
  'applied',
  'response_rate',
  'offers',
  'pipeline',
  'weekly',
  'upcoming',
  'activity',
] as const;
export type DashboardCard = (typeof DASHBOARD_CARDS)[number];

export interface DashboardLayout {
  /** Every card, visible or not, in display order. */
  order: DashboardCard[];
  hidden: DashboardCard[];
}

/** Per-user UI settings. Kept in the database so they follow the user between browsers. */
export interface UserPreferences {
  dashboard: DashboardLayout;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dashboard: { order: [...DASHBOARD_CARDS], hidden: [] },
};

/**
 * Cleans up a stored layout: drops cards that no longer exist, removes duplicates and appends
 * any card that was added since the layout was saved so it does not vanish silently.
 */
export function normalizeDashboard(layout: Partial<DashboardLayout> | undefined): DashboardLayout {
  const known = (cards: DashboardCard[] | undefined) =>
    (cards ?? []).filter(
      (card, index, all) => DASHBOARD_CARDS.includes(card) && all.indexOf(card) === index,
    );
  const order = known(layout?.order);
  for (const card of DASHBOARD_CARDS) if (!order.includes(card)) order.push(card);
  return { order, hidden: known(layout?.hidden) };
}
