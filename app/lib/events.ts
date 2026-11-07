// Single source of truth for vendor events and fees.
// The order here is the order shown in the Select Event dropdown.
// The first event is selected by default.

export type VendorEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  feeCents: number;
  booths: string[];
  tagSlug: string;
};

export const EVENTS: Record<string, VendorEvent> = {
  mountain_magic: {
    id: 'mountain_magic',
    name: 'Mountain Magic Christmas',
    date: 'December 2026 (TBD)',
    time: 'TBD',
    feeCents: 7500,
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

export function feeCentsFor(eventKey: unknown): number {
  return (typeof eventKey === 'string' && EVENTS[eventKey]?.feeCents) || DEFAULT_FEE_CENTS;
}

export function formatFee(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
