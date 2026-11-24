# Vendor tracking: web app, Stripe, HighLevel

One vendor application, three systems, one story. Stripe is the source of truth for money.
HighLevel (location `ltcv3MxZCgXvlwLhieDR`) is where the Chamber sees and acts on vendors.

## Flow

| Step | Web app | Stripe | HighLevel (in this order) |
|---|---|---|---|
| Submit form | `/api/submit` | | upsert contact, note with all details, custom fields, then tags `wcoc - vendor-app - submitted`, `action - vendor-app - payment-pending`, `campaign - {event} - vendor` |
| Open payment page | `/api/create-payment-intent` | Customer reused by email (name, phone, address, company), PaymentIntent with `ghlContactId` and every form detail in metadata | Stripe customer id and PaymentIntent id in custom fields, or a note when those fields do not exist |
| Payment succeeds | `/api/stripe-webhook` | `payment_intent.succeeded` | note (amount paid, PaymentIntent, receipt URL), fields, then tag `action - vendor-app - payment-completed`; remove payment-pending, payment-failed, payment-canceled |
| Payment fails | `/api/stripe-webhook` | `payment_intent.payment_failed` | note (reason, decline code), then tag `action - vendor-app - payment-failed`. payment-pending stays: the vendor can retry |
| Payment canceled | `/api/stripe-webhook` | `payment_intent.canceled` | note, then tag `action - vendor-app - payment-canceled`; remove payment-pending |

Details are always written before the tag that triggers a workflow, so the board alert can include them.
The app never sends email. Board alerts are a HighLevel workflow (below).

## Why no vendor was ever marked paid

On 2026-11-24 an unsigned POST to the live webhook answered `500 {"error":"Webhook not configured"}`.
The old route returned exactly that when `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` was empty.
`STRIPE_SECRET_KEY` is set (payments are created), so **`STRIPE_WEBHOOK_SECRET` is missing in Production**.
Every Stripe event (if the endpoint is registered at all in the Chamber's Stripe account) was refused
before it reached HighLevel. The `wcoc - vendor-app - paid` tag was never created because that code
never ran. HighLevel creates a tag the first time it is added.

Also check: the endpoint may not be registered in the **Chamber's** Stripe account. The vendor site
charges through the Chamber's own account (the key in Vercel), not the RazoRSharp parent account,
which has no vendor payments and no endpoint for this site.

## Setup

### 1. Vercel env vars (project `weaverville-vendors`, Production and Preview)

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Chamber Stripe secret key (already set) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chamber Stripe publishable key (already set) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` signing secret from step 2. **Missing today.** |
| `GHL_WCOC_API_KEY` | HighLevel Private Integration token for the WCOC location. Scopes: contacts read/write, contact notes write, contact tags write, locations custom fields read. (`GHL_API_KEY` is still read as a fallback.) |
| `GHL_LOCATION_ID` | Optional. Defaults to `ltcv3MxZCgXvlwLhieDR`. |

Redeploy after adding them (push a commit or "Redeploy" the latest production deployment).

### 2. Stripe webhook (in the Chamber's Stripe account, live mode)

Developers, Webhooks, Add endpoint:

- URL: `https://vendors.weavervilleca.org/api/stripe-webhook` (exact, no trailing slash: Stripe does not follow redirects)
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Check: in the endpoint page, "Send test event" with `payment_intent.succeeded`. The response should be
`200` with `"status":"ignored"` (test events have no vendor metadata). A `500 Webhook not configured`
means an env var is still missing; `400 Invalid signature` means the secret is from another endpoint.

### 3. Backfill anyone who already paid

```bash
vercel env pull .env.local          # in this repo, linked to weaverville-vendors
node --env-file=.env.local --import tsx scripts/reconcile-vendors.ts            # dry run, read only
node --env-file=.env.local --import tsx scripts/reconcile-vendors.ts --apply    # writes note, fields, paid tag
```

### 4. HighLevel board alert workflows (built in the UI)

Two workflows, because one shared guard tag would stop the payment alert from ever sending after the
application alert.

**WCOC | Vendors | Board alert: application**
- Trigger: Contact Tag added `wcoc - vendor-app - submitted`
- Filter: contact does **not** have tag `wcoc - vendor-app - board-notified` (stops repeat alerts when a
  vendor resubmits)
- Send Email (internal) to `president@weavervilleca.org`, `wildcreations135@yahoo.com`
  - Subject: `New vendor application: {{contact.company_name}}`
  - Body: contact name, business, email, phone, address, and the vendor custom fields (event, booth type,
    fee option, preferred days, amount, business description, payment status), plus a link to the contact
- Add tag `wcoc - vendor-app - board-notified`

**WCOC | Vendors | Board alert: payment received**
- Trigger: Contact Tag added `action - vendor-app - payment-completed`
- Send Email (internal) to the same two addresses
  - Subject: `Vendor paid: {{contact.company_name}}`
  - Body: as above, plus amount paid, Stripe PaymentIntent and receipt URL
- Add tag `wcoc - vendor-app - board-notified` (so a vendor who paid before the application alert
  existed does not get a late application alert)

The payment alert sends once per payment: the webhook skips repeated Stripe events, and HighLevel does
not re-fire a tag trigger for a tag the contact already has. Notes cannot be merged into an email; the
custom fields can, so create them first (below). Until they exist, the email can link to the contact,
where the notes hold every detail.

## Tags

| Tag | Exists | Set by |
|---|---|---|
| `wcoc - vendor-app - submitted` | yes | app, on submit |
| `action - vendor-app - payment-pending` | yes | app, on submit |
| `action - vendor-app - payment-completed` | yes (unused until now) | webhook, on success |
| `action - vendor-app - payment-failed` | **proposed** | webhook, on failure |
| `action - vendor-app - payment-canceled` | **proposed** | webhook, on cancel |
| `wcoc - vendor-app - board-notified` | yes | board-alert workflow only |
| `wcoc - vendor-app - paid` | no | no longer written; replaced by payment-completed |

Add the two proposed tags to the WCOC Tag Library before merging.

## Custom fields

The app looks up the location's contact custom fields by name and fills only those that exist. It
never creates fields. Proposed fields (Contact, single line unless noted):

| Field name | Filled with |
|---|---|
| Vendor Event | event name |
| Booth Type | booth choice |
| Vendor Fee Option | 1 Day / 2 Days / Entire Event |
| Vendor Preferred Days | preferred day(s) |
| Vendor Fee Amount | amount due, then amount paid |
| Vendor Business Description | products / services (multi-line) |
| Vendor Payment Status | Pending payment / Paid / Payment failed / Canceled |
| Stripe Customer ID | `cus_...` |
| Stripe Payment Intent ID | `pi_...` |
| Stripe Receipt URL | receipt link |

Matching is by name or key, case and punctuation ignored (for example "Booth Type" or
`contact.booth_type`). Until they exist, the same data is in the contact notes.

## Tests

`npm test` runs the sync, webhook and reconcile tests against a fake HighLevel API and a fake Stripe.
No network, no live data.
