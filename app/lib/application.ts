// The vendor's application, kept in this browser tab between the form, payment,
// and confirmation steps. Nothing here is trusted by the server for pricing.

export const APPLICATION_KEY = 'wcoc_vendor_application';
export const PAYMENT_KEY = 'wcoc_vendor_payment';

export type Application = {
  email: string;
  contactName: string;
  businessName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  boothType?: string;
  eventKey?: string;
  feeOption?: string;
  preferredDays?: string;
  ghlContactId?: string | null;
  [key: string]: unknown;
};

export function loadApplication(): Application | null {
  try {
    const raw = sessionStorage.getItem(APPLICATION_KEY);
    if (!raw) return null;
    const app = JSON.parse(raw);
    return app && app.email && app.contactName ? app : null;
  } catch {
    return null;
  }
}

export function saveApplication(app: Application) {
  try { sessionStorage.setItem(APPLICATION_KEY, JSON.stringify(app)); } catch { /* storage blocked */ }
}

export function loadPaymentIntentId(): string {
  try { return sessionStorage.getItem(PAYMENT_KEY) || ''; } catch { return ''; }
}

export function savePaymentIntentId(id: string) {
  try { sessionStorage.setItem(PAYMENT_KEY, id); } catch { /* storage blocked */ }
}

/** After a successful payment: keep a copy for the receipt view, drop the open payment. */
export function clearAfterPayment() {
  try { sessionStorage.removeItem(PAYMENT_KEY); } catch { /* storage blocked */ }
}
