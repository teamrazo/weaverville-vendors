/**
 * Reconcile vendor payments: Stripe (source of truth) against HighLevel.
 *
 * Lists every succeeded vendor PaymentIntent in Stripe and flags the HighLevel contacts that
 * are missing the "action - vendor-app - payment-completed" tag. Read-only by default.
 *
 *   npx tsx scripts/reconcile-vendors.ts                  dry run, prints the report
 *   npx tsx scripts/reconcile-vendors.ts --apply          also fixes flagged contacts (note, fields, tags)
 *   npx tsx scripts/reconcile-vendors.ts --since=2026-11-01
 *
 * Needs STRIPE_SECRET_KEY (the Chamber's Stripe account) and GHL_WCOC_API_KEY. Pull them with
 * `vercel env pull .env.local` and run with `node --env-file=.env.local --import tsx ...`, or
 * export them in the shell.
 */
import Stripe from 'stripe';
import { GHL_TAGS, GhlClient, ghlConfigFromEnv } from '../app/lib/ghl';
import { applyPaymentOutcome, formatUsd } from '../app/lib/vendor-sync';

export type ReconcileRow = {
  paymentIntent: string;
  amount: string;
  email: string;
  business: string;
  event: string;
  contactId: string | null;
  status: 'ok' | 'missing-paid-tag' | 'no-contact' | 'fixed' | 'error';
  detail?: string;
};

type Deps = {
  stripe: { paymentIntents: { search(params: Stripe.PaymentIntentSearchParams): Stripe.ApiSearchResultPromise<Stripe.PaymentIntent>; retrieve(id: string, params?: Stripe.PaymentIntentRetrieveParams): Promise<Stripe.PaymentIntent> } };
  ghl: GhlClient;
  log?: (line: string) => void;
};

export async function reconcileVendors(deps: Deps, opts: { apply?: boolean; since?: Date } = {}): Promise<ReconcileRow[]> {
  const log = deps.log || ((l: string) => console.log(l));
  let query = "metadata['source']:'weaverville-vendors' AND status:'succeeded'";
  if (opts.since) query += ` AND created>=${Math.floor(opts.since.getTime() / 1000)}`;

  const intents: Stripe.PaymentIntent[] = [];
  let page: string | undefined;
  do {
    const res = await deps.stripe.paymentIntents.search({ query, limit: 100, page });
    intents.push(...res.data);
    page = res.has_more ? res.next_page || undefined : undefined;
  } while (page);

  const rows: ReconcileRow[] = [];
  for (const pi of intents) {
    const m = pi.metadata || {};
    const email = m.email || pi.receipt_email || '';
    const row: ReconcileRow = {
      paymentIntent: pi.id, amount: formatUsd(pi.amount_received || pi.amount), email,
      business: m.businessName || '', event: [m.eventName, m.feeOptionLabel].filter(Boolean).join(' / '),
      contactId: null, status: 'ok',
    };
    try {
      row.contactId = m.ghlContactId || (email ? await deps.ghl.findContactByEmail(email) : null);
      const tags = row.contactId ? await deps.ghl.getContactTags(row.contactId) : [];
      const paid = tags.includes(GHL_TAGS.paymentCompleted.toLowerCase());
      row.status = !row.contactId ? 'no-contact' : paid ? 'ok' : 'missing-paid-tag';
      if (opts.apply && row.status !== 'ok') {
        const full = await deps.stripe.paymentIntents.retrieve(pi.id, { expand: ['latest_charge'] });
        row.contactId = await applyPaymentOutcome(deps.ghl, full, 'succeeded');
        row.status = 'fixed';
      }
    } catch (err: any) {
      row.status = 'error';
      row.detail = err?.body ? `${err.message} ${err.body}` : err?.message;
    }
    rows.push(row);
  }

  const count = (s: ReconcileRow['status']) => rows.filter((r) => r.status === s).length;
  log(`Succeeded vendor payments in Stripe: ${rows.length}`);
  log(`  in step with HighLevel: ${count('ok')}`);
  log(`  missing paid tag:       ${count('missing-paid-tag')}`);
  log(`  no HighLevel contact:   ${count('no-contact')}`);
  if (opts.apply) log(`  fixed now:              ${count('fixed')}`);
  log(`  errors:                 ${count('error')}`);
  for (const r of rows.filter((x) => x.status !== 'ok')) {
    log(`- [${r.status}] ${r.paymentIntent} ${r.amount} ${r.email} ${r.business ? `(${r.business})` : ''} ${r.event}${r.detail ? `\n    ${r.detail}` : ''}`);
  }
  if (!opts.apply && rows.some((r) => r.status === 'missing-paid-tag' || r.status === 'no-contact')) {
    log('\nDry run. Nothing was changed. Re-run with --apply to write the note, fields and payment-completed tag.');
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const sinceArg = args.find((a) => a.startsWith('--since='))?.slice('--since='.length);
  const since = sinceArg ? new Date(`${sinceArg}T00:00:00-08:00`) : undefined;
  const key = process.env.STRIPE_SECRET_KEY;
  const ghl = new GhlClient(ghlConfigFromEnv());
  if (!key || !ghl.configured) {
    console.error('Set STRIPE_SECRET_KEY and GHL_WCOC_API_KEY first.');
    process.exit(1);
  }
  const rows = await reconcileVendors({ stripe: new Stripe(key), ghl }, { apply, since });
  process.exit(rows.some((r) => r.status === 'error') ? 2 : 0);
}

if (process.argv[1] && /reconcile-vendors\.[tj]s$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
