'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail } from 'lucide-react';
import Steps from '../components/Steps';
import { formatFee } from '../lib/events';
import { clearAfterPayment, loadApplication } from '../lib/application';

type PaymentStatus = {
  status: string;
  amountCents: number;
  eventName: string;
  optionLabel: string;
  boothType: string;
};

function ConfirmationContent() {
  const params = useSearchParams();
  const id = params.get('payment_intent') || '';
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [email, setEmail] = useState('');

  useEffect(() => {
    setEmail(loadApplication()?.email || '');
    if (!id) return;
    let cancelled = false;
    let tries = 0;
    // Bank and wallet payments can take a moment to settle. Check a few times.
    const check = async () => {
      const res = await fetch(`/api/payment-status?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = res.ok ? ((await res.json()) as PaymentStatus) : null;
      if (cancelled) return;
      setPayment(data);
      setLoading(false);
      if (data?.status === 'succeeded') clearAfterPayment();
      if (data?.status === 'processing' && tries++ < 5) setTimeout(check, 3000);
    };
    check().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const status = payment?.status || params.get('redirect_status') || '';
  const paid = status === 'succeeded';
  const processing = status === 'processing';
  const failed = Boolean(id) && !loading && !paid && !processing;

  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-6 md:p-8 text-center max-w-2xl mx-auto space-y-6">
      <Steps current={paid || processing || !id ? 2 : 1} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <Loader2 className="animate-spin" size={20} aria-hidden="true" /> Confirming your payment...
        </div>
      ) : failed ? (
        <>
          <AlertCircle className="mx-auto text-red-600" size={48} aria-hidden="true" />
          <h2 className="text-2xl font-bold font-serif-brand text-chamber-black">Payment not completed</h2>
          <p className="text-gray-600">Your application is saved, but the payment did not go through. No charge was made.</p>
          <a href="/payment" className="inline-block rounded-md bg-chamber-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-chamber-gold">
            Try payment again
          </a>
        </>
      ) : (
        <>
          {processing ? (
            <Clock className="mx-auto text-chamber-goldDeep" size={48} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mx-auto text-green-700" size={48} aria-hidden="true" />
          )}
          <h2 className="text-3xl font-bold font-serif-brand text-chamber-black">
            {processing ? 'Payment processing' : 'Application submitted'}
          </h2>
          <p className="text-gray-600">
            {processing
              ? 'Your bank is confirming the payment. You will get an email receipt once it clears. There is nothing more you need to do.'
              : 'Thank you for applying to be a vendor with the Weaverville Chamber of Commerce.'}
          </p>

          {payment && (
            <div className="mx-auto max-w-md rounded-lg border border-chamber-gold/40 bg-chamber-gold/10 p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-700">
                  {payment.eventName}
                  {payment.optionLabel ? ` · ${payment.optionLabel}` : ''}
                </span>
                <span className="font-bold text-chamber-black">{formatFee(payment.amountCents)}</span>
              </div>
              {payment.boothType && <p className="mt-1 text-xs text-gray-600">{payment.boothType}</p>}
              {email && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                  <Mail size={13} aria-hidden="true" /> Receipt sent to {email}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!failed && !loading && (
        <div className="bg-chamber-black text-chamber-cream rounded-lg p-6 text-left space-y-3 border border-chamber-gold/40">
          <h3 className="font-bold font-serif-brand text-chamber-gold text-lg">What happens next</h3>
          <ol className="list-decimal list-inside text-sm text-gray-200 space-y-2">
            <li><strong className="text-chamber-gold">Board review:</strong> The Chamber Board reviews applications for booth variety and safety.</li>
            <li><strong className="text-chamber-gold">Timeline:</strong> Please allow <strong>3 to 5 business days</strong>.</li>
            <li><strong className="text-chamber-gold">Acceptance notice:</strong> Once approved, you will get an email with arrival, setup, and booth details, including your confirmed day(s).</li>
          </ol>
        </div>
      )}

      <div className="pt-4 border-t border-chamber-gold/30 text-sm text-gray-600">
        <p>Questions about your application?</p>
        <p className="font-semibold text-gray-900 mt-1">
          Contact Magdalena Elorriaga &middot; <a href="tel:+19099636137" className="underline">909-963-6137</a>
        </p>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
