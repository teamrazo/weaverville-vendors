'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import Steps from '../components/Steps';
import { EVENTS, formatFee, resolveFee } from '../lib/events';
import {
  type Application,
  loadApplication,
  loadPaymentIntentId,
  saveApplication,
  savePaymentIntentId,
} from '../lib/application';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

// Matches the Chamber palette inside Stripe's secure fields.
const appearance: StripeElementsOptions['appearance'] = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#161513',
    colorText: '#161513',
    colorDanger: '#b91c1c',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    borderRadius: '6px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input:focus': { borderColor: '#161513', boxShadow: '0 0 0 2px rgba(240, 211, 151, 0.6)' },
    '.Tab--selected': { borderColor: '#161513', boxShadow: '0 0 0 1px #161513' },
  },
};

function CheckoutForm({
  application,
  amountLabel,
  paymentIntentId,
  disabled,
  revision,
}: {
  application: Application;
  amountLabel: string;
  paymentIntentId: string;
  disabled: boolean;
  revision: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The server changed the amount: pull it into Stripe's fields and wallet buttons.
  useEffect(() => {
    if (revision > 0 && elements) elements.fetchUpdates().catch(() => undefined);
  }, [revision, elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || 'Please check your payment details.');
      setSubmitting(false);
      return;
    }

    // Card payments finish here without leaving the page. Methods that need a
    // bank or wallet step redirect, then come back to /confirmation.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/confirmation`,
        receipt_email: application.email,
      },
    });

    if (error) {
      setErrorMessage(
        error.type === 'card_error' || error.type === 'validation_error'
          ? error.message || 'Your card was not accepted. Please try another payment method.'
          : 'Payment could not be completed. Please try again.'
      );
      setSubmitting(false);
      return;
    }

    router.push(`/confirmation?payment_intent=${encodeURIComponent(paymentIntent?.id || paymentIntentId)}&redirect_status=${paymentIntent?.status || 'processing'}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: { type: 'tabs', defaultCollapsed: false },
          business: { name: 'Weaverville Chamber of Commerce' },
          defaultValues: {
            billingDetails: {
              name: application.contactName,
              email: application.email,
              phone: application.phone || undefined,
              address: {
                line1: application.address || undefined,
                city: application.city || undefined,
                state: application.state || undefined,
                postal_code: application.zip || undefined,
                country: 'US',
              },
            },
          },
        }}
      />

      {!ready && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading secure payment fields...
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !ready || submitting || disabled}
        className="flex w-full items-center justify-center gap-2 bg-chamber-black hover:bg-chamber-dark disabled:opacity-60 disabled:cursor-not-allowed text-chamber-gold font-bold py-3.5 px-6 rounded-md shadow-chamber border border-chamber-gold/40 transition-colors uppercase tracking-wide text-sm"
      >
        {submitting ? (
          <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Processing payment...</>
        ) : (
          <><Lock size={15} aria-hidden="true" /> Pay {amountLabel}</>
        )}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [missing, setMissing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [revision, setRevision] = useState(0);
  const configured = Boolean(publishableKey && stripePromise);
  const started = useRef(false);

  // Starts the payment, or updates the one already open for this application.
  const preparePayment = useCallback(async (app: Application) => {
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...app, paymentIntentId: loadPaymentIntentId() }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.alreadyPaid) {
      router.replace(`/confirmation?payment_intent=${encodeURIComponent(data.paymentIntentId)}&redirect_status=${data.status}`);
      return null;
    }
    if (!res.ok || !data.clientSecret) throw new Error(data.error || 'Unable to start payment.');
    savePaymentIntentId(data.paymentIntentId);
    setPaymentIntentId(data.paymentIntentId);
    setAmountCents(data.amountCents);
    return data.clientSecret as string;
  }, [router]);

  useEffect(() => {
    if (!configured || started.current) return;
    started.current = true;
    const app = loadApplication();
    if (!app) { setMissing(true); return; }
    setApplication(app);
    preparePayment(app)
      .then((secret) => { if (secret) setClientSecret(secret); })
      .catch((err) => setLoadError(err.message || 'Unable to start payment. Please try again later.'));
  }, [configured, preparePayment]);

  const event = application?.eventKey ? EVENTS[application.eventKey] : undefined;
  const resolved = application ? resolveFee(application.eventKey, application.feeOption) : null;
  const shownCents = amountCents ?? resolved?.feeCents ?? null;
  const amountLabel = shownCents !== null ? formatFee(shownCents) : '';

  // Switching the day option updates the same payment, and Stripe's fields refresh in place.
  const changeOption = async (optionId: string) => {
    if (!application || optionId === application.feeOption) return;
    const next = { ...application, feeOption: optionId, preferredDays: '' };
    setUpdating(true);
    setLoadError(null);
    try {
      await preparePayment(next);
      setApplication(next);
      saveApplication(next);
      setRevision((r) => r + 1);
    } catch (err: any) {
      setLoadError(err.message || 'Could not update your selection. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // The client secret is fixed for the life of the PaymentIntent, so Elements mounts once.
  const elementsOptions = useMemo<StripeElementsOptions | undefined>(
    () => (clientSecret ? { clientSecret, appearance, loader: 'auto' } : undefined),
    [clientSecret]
  );

  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-6 md:p-8 max-w-xl mx-auto">
      <Steps current={1} />
      <h2 className="text-2xl font-bold font-serif-brand text-chamber-black text-center">Complete Your Payment</h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Your application is saved. Pay the vendor fee to send it to the Chamber Board for review.
      </p>

      {!configured && (
        <p className="mt-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-4">
          Online payment is not available right now. Please contact the Chamber.
        </p>
      )}

      {missing && (
        <div className="mt-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2">
          <p>We could not find your application on this device. It may have been opened in another browser or tab.</p>
          <a href="/" className="inline-block font-semibold underline">Return to the application form</a>
        </div>
      )}

      {application && event && (
        <section className="mt-6 rounded-lg border border-chamber-gold/40 bg-chamber-black p-4 text-sm text-chamber-cream" aria-label="Order summary">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-chamber-gold">{event.name}</p>
              <p className="text-gray-300">{event.date}</p>
              {application.businessName && <p className="text-gray-300">{application.businessName}</p>}
              {application.boothType && <p className="text-gray-400 text-xs mt-1">{application.boothType}</p>}
              {application.preferredDays && <p className="text-gray-400 text-xs">Preferred: {application.preferredDays}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
              <p className="text-2xl font-bold text-chamber-gold" aria-live="polite">
                {updating ? <Loader2 size={20} className="ml-auto animate-spin" aria-label="Updating total" /> : amountLabel}
              </p>
            </div>
          </div>

          {event.options?.length ? (
            <div className="mt-4 border-t border-chamber-gold/30 pt-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Days attending</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Days attending">
                {event.options.map((opt) => {
                  const active = application.feeOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={updating}
                      onClick={() => changeOption(opt.id)}
                      className={`rounded-md border px-2 py-2 text-center transition-colors disabled:opacity-60 ${
                        active ? 'border-chamber-gold bg-chamber-gold text-chamber-black' : 'border-chamber-gold/40 text-chamber-cream hover:border-chamber-gold'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{opt.label}</span>
                      <span className="block text-sm font-bold">{formatFee(opt.feeCents)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{loadError}</p>
      )}

      {configured && application && !clientSecret && !loadError && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Preparing secure payment...
        </div>
      )}

      {clientSecret && stripePromise && application && elementsOptions && (
        <div className="mt-6">
          <Elements stripe={stripePromise} options={elementsOptions}>
            <CheckoutForm
              application={application}
              amountLabel={amountLabel}
              paymentIntentId={paymentIntentId}
              disabled={updating}
              revision={revision}
            />
          </Elements>
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <ShieldCheck size={14} aria-hidden="true" /> Payments are encrypted and processed by Stripe. The Chamber never sees your card number.
      </p>
      <p className="mt-2 text-center text-xs">
        <a href="/" className="text-gray-500 underline hover:text-chamber-black">Edit application</a>
      </p>
    </div>
  );
}
