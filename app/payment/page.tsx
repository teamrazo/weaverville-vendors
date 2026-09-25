'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function CheckoutForm({ email }: { email: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const returnUrl = `${window.location.origin}/confirmation?email=${encodeURIComponent(email)}`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    // If we get here, confirmPayment failed before redirecting (e.g. card declined).
    if (error) {
      setErrorMessage(error.message || 'Payment could not be completed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <PaymentElement />

      {errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-[#D4AF37] hover:bg-[#B8962E] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md shadow-chamber transition-colors uppercase tracking-wide text-sm"
      >
        {submitting ? 'Processing...' : 'Complete $20.00 Payment'}
      </button>
    </form>
  );
}

function PaymentContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const configured = Boolean(publishableKey) && Boolean(stripePromise);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();

        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error || 'Unable to start payment.');
        }

        if (!cancelled) {
          setClientSecret(data.clientSecret);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err.message || 'Unable to start payment. Please try again later.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured]);

  const elementsOptions = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret]
  );

  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-6 md:p-8 text-center max-w-xl mx-auto space-y-6">
      <div className="inline-block p-3 bg-chamber-gold/20 text-chamber-goldDeep rounded-full text-2xl">
        💳
      </div>
      <h2 className="text-2xl font-bold font-serif-brand text-chamber-black">Vendor Fee Payment</h2>
      <p className="text-gray-600 text-sm">
        Your application has been received! Please complete the <strong>$20.00 Vendor Application Fee</strong> to finalize your submission for Board review.
      </p>

      <div className="bg-chamber-black text-chamber-cream rounded-lg p-4 text-left text-sm space-y-2 border border-chamber-gold/40">
        <div className="flex justify-between border-b border-chamber-gold/30 pb-2">
          <span className="text-gray-300">Application Item:</span>
          <span className="font-semibold text-chamber-cream">WCoC Event Vendor Fee</span>
        </div>
        <div className="flex justify-between pt-1 text-base font-bold text-chamber-gold">
          <span>Total Due:</span>
          <span>$20.00</span>
        </div>
      </div>

      {!configured && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-4">
          Payment system not yet configured. Contact the Chamber.
        </p>
      )}

      {configured && loading && (
        <p className="text-sm text-gray-500">Preparing secure payment form...</p>
      )}

      {configured && !loading && loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {loadError}
        </p>
      )}

      {configured && !loading && !loadError && clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={elementsOptions}>
          <CheckoutForm email={email} />
        </Elements>
      )}

      <p className="text-xs text-gray-400">Secured via Stripe Payment Gateway</p>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading payment screen...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
