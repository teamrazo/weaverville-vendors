// Single source of truth for vendor events and fees.
// The order here is the order shown in the Select Event dropdown.
// The first event is selected by default.

// A priced choice within an event, such as how many days a vendor attends.
export type FeeOption = {
  id: string;
  label: string;
  detail: string;
  feeCents: number;
  /** Ask which day(s) the vendor prefers. */
  asksDays?: boolean;
};

export type VendorEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  /** Fee when the event has no options. With options, the lowest option fee. */
  feeCents: number;
  /** When present, the vendor must pick one, and its fee is charged. */
  options?: FeeOption[];
  booths: string[];
  tagSlug: string;
};

export const EVENTS: Record<string, VendorEvent> = {
  mountain_magic: {
    id: 'mountain_magic',
    name: 'Mountain Magic Christmas',
    date: 'December 2026 (TBD)',
    time: 'TBD',
    feeCents: 2500,
    options: [
      { id: 'one_day', label: '1 Day', detail: 'One day of the event', feeCents: 2500, asksDays: true },
      { id: 'two_days', label: '2 Days', detail: 'Any two days of the event', feeCents: 5000, asksDays: true },
      { id: 'full_event', label: 'Entire Event', detail: 'Every day of the event', feeCents: 7500 },
    ],
    booths: ['Indoor Hall Space', 'Outdoor Booth Space'],
    tagSlug: 'mountain-magic-2026'
  },
  witches_brigade: {
    id: 'witches_brigade',
    name: 'Weaverville 8th Annual Witches Brigade',
    date: 'October 17, 2026',
    time: '10:00 AM – 5:00 PM (Setup before 10:00 AM)',
    feeCents: 2000,
    booths: ['Outdoor 10x10 (Near Visitor Center)', 'Table Space (Positioned near businesses)'],
    tagSlug: 'witches-brigade-2026'
  },
  july_4th_fireworks: {
    id: 'july_4th_fireworks',
    name: '4th Of July Fireworks & Festival',
    date: 'July 4, 2026',
    time: '12:00 PM – 9:00 PM',
    feeCents: 2000,
    booths: ['Standard Vendor Plot (10x10)', 'Food/Beverage Truck Spot'],
    tagSlug: '4th-july-fireworks-2026'
  }
};

export const DEFAULT_EVENT_KEY = Object.keys(EVENTS)[0];

export const DEFAULT_FEE_CENTS = 2000;

export type ResolvedFee = { feeCents: number; option: FeeOption | null };

/**
 * The fee for an event and option. Returns null when the event is unknown, or when
 * the event has options and the option is missing or unknown. Use on the server
 * to price a payment; never trust a price from the browser.
 */
export function resolveFee(eventKey: unknown, optionId: unknown): ResolvedFee | null {
  const event = typeof eventKey === 'string' ? EVENTS[eventKey] : undefined;
  if (!event) return null;
  if (!event.options?.length) return { feeCents: event.feeCents, option: null };
  const option = event.options.find((o) => o.id === optionId);
  return option ? { feeCents: option.feeCents, option } : null;
}

/** Display text for an event fee: one price, or each option with its price. */
export function feeSummary(event: VendorEvent): string {
  if (!event.options?.length) return formatFee(event.feeCents);
  return event.options.map((o) => `${o.label} ${formatFee(o.feeCents)}`).join(' · ');
}

export function feeCentsFor(eventKey: unknown, optionId?: unknown): number {
  return resolveFee(eventKey, optionId)?.feeCents ?? ((typeof eventKey === 'string' && EVENTS[eventKey]?.feeCents) || DEFAULT_FEE_CENTS);
}

export function formatFee(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
