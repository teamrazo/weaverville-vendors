'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { EVENTS, DEFAULT_EVENT_KEY, feeSummary, formatFee, resolveFee } from './lib/events';
import { APPLICATION_KEY, PAYMENT_KEY, loadApplication } from './lib/application';
import Steps from './components/Steps';

export default function ApplicationPage() {
  const router = useRouter();
  const [selectedEventKey, setSelectedEventKey] = useState(DEFAULT_EVENT_KEY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feeOption, setFeeOption] = useState('');
  const [preferredDays, setPreferredDays] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const currentEvent = EVENTS[selectedEventKey];
  const hasOptions = Boolean(currentEvent.options?.length);
  const resolved = resolveFee(selectedEventKey, feeOption);
  const selectedOption = resolved?.option || null;
  const feeLabel = resolved ? formatFee(resolved.feeCents) : null;

  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Weaverville',
    state: 'CA',
    zip: '96093',
    description: '',
    boothType: currentEvent.booths[0],
    liabilityAccepted: false,
    signatureName: '',
    website: ''
  });

  // Coming back from the payment step: reopen the saved application.
  useEffect(() => {
    const saved = loadApplication();
    if (!saved || !saved.eventKey || !EVENTS[saved.eventKey]) return;
    const ev = EVENTS[saved.eventKey];
    setSelectedEventKey(saved.eventKey);
    setFeeOption(String(saved.feeOption || ''));
    setPreferredDays(String(saved.preferredDays || ''));
    setFormData((prev) => {
      const next = { ...prev };
      (Object.keys(prev) as Array<keyof typeof prev>).forEach((k) => {
        if (k === 'website' || k === 'liabilityAccepted' || k === 'signatureName') return;
        const v = saved[k];
        if (typeof v === 'string' && v) (next as Record<string, unknown>)[k] = v;
      });
      if (!ev.booths.includes(next.boothType)) next.boothType = ev.booths[0];
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!resolved) {
      setFormError('Please choose how many days you will attend.');
      document.getElementById('fee-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!formData.liabilityAccepted) {
      setFormError('Please check the liability disclaimer box to continue.');
      return;
    }
    if (!formData.signatureName) {
      setFormError('Please type your full legal name to sign.');
      return;
    }

    setIsSubmitting(true);

    const application = {
      ...formData,
      eventKey: selectedEventKey,
      eventName: currentEvent.name,
      eventDate: currentEvent.date,
      tagSlug: currentEvent.tagSlug,
      feeOption: selectedOption?.id || '',
      feeOptionLabel: selectedOption?.label || '',
      preferredDays: selectedOption?.asksDays ? preferredDays.trim() : '',
      fee: resolved.feeCents / 100
    };

    // The payment step reads this to attach the vendor's contact details
    // to the Stripe customer and payment.
    const saveApplication = (ghlContactId: string | null) => {
      try {
        sessionStorage.setItem(APPLICATION_KEY, JSON.stringify({ ...application, ghlContactId }));
        // A new application starts a new payment.
        sessionStorage.removeItem(PAYMENT_KEY);
      } catch {
        /* storage blocked; payment page will ask them to resubmit */
      }
    };

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application)
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        saveApplication(data.ghlContactId || null);
        router.push('/payment');
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'There was an issue submitting your application. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      saveApplication(null);
      setIsSubmitting(false);
      router.push('/payment');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-6 md:p-8">
      <Steps current={0} />
      <h2 className="text-2xl font-bold font-serif-brand text-chamber-black mb-1 pb-3 border-b-2 border-chamber-gold/60">
        Official Event Vendor Application
      </h2>
      <p className="text-xs uppercase tracking-widest text-chamber-goldDeep font-semibold mt-2 mb-6">
        Weaverville Chamber of Commerce &middot; Est. 1909
      </p>

      <div className="mb-6 rounded-md border border-chamber-gold/40 bg-chamber-gold/10 p-4 text-sm text-gray-800 space-y-2">
        <p className="font-semibold text-chamber-black">
          Bring your booth to Weaverville&apos;s community events.
        </p>
        <p>
          Share your crafts, gifts, food, or business with visitors and neighbors in historic downtown Weaverville.
          Choose your event, complete the form, and pay the application fee online. It takes about five minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Honeypot: hidden from people, filled by bots. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
        </div>

        {/* Event Selection Dropdown */}
        <div>
          <label htmlFor="event" className="block text-sm font-semibold text-gray-700 mb-2">Select Event *</label>
          <select
            id="event"
            name="event"
            value={selectedEventKey}
            onChange={(e) => {
              const k = e.target.value;
              setSelectedEventKey(k);
              setFeeOption('');
              setPreferredDays('');
              setFormData(prev => ({ ...prev, boothType: EVENTS[k].booths[0] }));
            }}
            className="w-full border border-gray-300 rounded-md p-3 text-gray-900 bg-chamber-gold/10 focus:ring-2 focus:ring-chamber-black font-medium"
          >
            {Object.entries(EVENTS).map(([key, ev]) => (
              <option key={key} value={key}>{ev.name}</option>
            ))}
          </select>
        </div>

        {/* Dynamic Event Details Box */}
        <div className="bg-chamber-black text-chamber-cream rounded-md p-4 space-y-1 text-sm border border-chamber-gold/40">
          <p><strong className="font-semibold text-chamber-gold">Event Name:</strong> {currentEvent.name}</p>
          <p><strong className="font-semibold text-chamber-gold">Date:</strong> {currentEvent.date}</p>
          <p><strong className="font-semibold text-chamber-gold">Time:</strong> {currentEvent.time}</p>
          <p><strong className="font-semibold text-chamber-gold">Vendor Fee:</strong> <span className="text-chamber-accent font-bold">{feeSummary(currentEvent)}</span></p>
        </div>

        {/* Day options, for events priced by attendance */}
        {hasOptions && (
          <fieldset id="fee-options" className="space-y-3">
            <legend className="block text-sm font-semibold text-gray-700 mb-2">How many days will you attend? *</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup">
              {currentEvent.options!.map((opt) => {
                const active = feeOption === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`relative flex cursor-pointer flex-col rounded-lg border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-chamber-black ${
                      active ? 'border-chamber-gold bg-chamber-gold/10' : 'border-gray-200 hover:border-chamber-gold/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feeOption"
                      value={opt.id}
                      checked={active}
                      onChange={() => { setFeeOption(opt.id); setFormError(null); }}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between">
                      <span className="font-semibold text-chamber-black">{opt.label}</span>
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          active ? 'border-chamber-black bg-chamber-black text-chamber-gold' : 'border-gray-300'
                        }`}
                      >
                        {active && <Check size={13} strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="mt-1 text-2xl font-bold text-chamber-black">{formatFee(opt.feeCents)}</span>
                    <span className="mt-1 text-xs text-gray-600">{opt.detail}</span>
                  </label>
                );
              })}
            </div>
            {selectedOption?.asksDays && (
              <div>
                <label htmlFor="preferredDays" className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Preferred day{selectedOption.id === 'one_day' ? '' : 's'} (optional)
                </label>
                <input
                  type="text"
                  id="preferredDays"
                  name="preferredDays"
                  value={preferredDays}
                  maxLength={120}
                  onChange={(e) => setPreferredDays(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
                  placeholder={selectedOption.id === 'one_day' ? 'e.g. Saturday' : 'e.g. Friday and Saturday'}
                />
                <p className="text-[11px] text-gray-500 mt-1">The Chamber confirms your day{selectedOption.id === 'one_day' ? '' : 's'} once the event schedule is set.</p>
              </div>
            )}
          </fieldset>
        )}

        {/* Vendor Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="businessName" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Business / Vendor Name *</label>
            <input
              required
              type="text"
              id="businessName"
              value={formData.businessName}
              name="organization" autoComplete="organization" autoCapitalize="words"
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
              placeholder="e.g. Trinity Crafts & Gifts"
            />
          </div>
          <div>
            <label htmlFor="contactName" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Contact Person Name *</label>
            <input
              required
              type="text"
              id="contactName"
              value={formData.contactName}
              name="name" autoComplete="name" autoCapitalize="words"
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone Number *</label>
            <input
              required
              type="tel"
              id="phone"
              value={formData.phone}
              name="tel" autoComplete="tel" inputMode="tel"
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
              placeholder="(530) 000-0000"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address *</label>
            <input
              required
              type="email"
              id="email"
              value={formData.email}
              name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mailing Address *</label>
          <input
            required
            type="text"
            id="address"
              value={formData.address}
              name="street-address" autoComplete="street-address"
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Street address, P.O. Box"
          />
        </div>

        {/* Product / Services Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Products / Services Description *</label>
          <textarea
            required
            rows={3}
            id="description"
              value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Briefly describe what you will sell, display, or promote..."
          />
        </div>

        {/* Booth Selection */}
        <div>
          <label htmlFor="boothType" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Booth Space Option *</label>
          <select
            id="boothType"
              value={formData.boothType}
            onChange={(e) => setFormData({ ...formData, boothType: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
          >
            {currentEvent.booths.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Disclaimer of Liability */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-xs text-gray-600 space-y-2">
          <p className="font-bold text-gray-800 uppercase">Vendor Agreement & Liability Disclaimer</p>
          <p>
            I understand that submission of this application does not guarantee acceptance or a specific booth location.
            If accepted, I agree to follow event rules, maintain a safe and orderly booth area, obtain any required permits or licenses,
            and accept full responsibility for my property, displays, products, and activities during the event.
          </p>
          <div className="pt-2 flex items-center space-x-2">
            <input
              required
              id="disclaimer"
              type="checkbox"
              checked={formData.liabilityAccepted}
              onChange={(e) => setFormData({ ...formData, liabilityAccepted: e.target.checked })}
              className="h-5 w-5 shrink-0 text-chamber-black rounded border-gray-300 focus:ring-chamber-gold"
            />
            <label htmlFor="disclaimer" className="text-sm font-medium text-gray-900 cursor-pointer">
              I have read, understand, and agree to the Liability Disclaimer *
            </label>
          </div>
        </div>

        {/* Electronic Signature */}
        <div>
          <label htmlFor="signatureName" className="block text-xs font-semibold text-gray-700 uppercase mb-1">Electronic Vendor Signature (Full Legal Name) *</label>
          <input
            required
            type="text"
            id="signatureName"
              value={formData.signatureName}
              name="signature" autoComplete="off" autoCapitalize="words"
            onChange={(e) => setFormData({ ...formData, signatureName: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 font-mono text-sm focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Type your full legal name to sign"
          />
          <p className="text-[11px] text-gray-500 mt-1">By typing your name, you acknowledge this electronic signature as legally binding.</p>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{formError}</p>
        )}

        {/* Order summary */}
        <div className="flex items-center justify-between rounded-md border border-chamber-gold/40 bg-chamber-gold/10 px-4 py-3 text-sm">
          <span className="text-gray-700">
            {currentEvent.name}
            {selectedOption ? ` · ${selectedOption.label}` : ''}
          </span>
          <span className="text-lg font-bold text-chamber-black">{feeLabel ?? 'Choose an option'}</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-chamber-black hover:bg-chamber-dark disabled:opacity-60 text-chamber-gold font-bold py-3.5 px-6 rounded-md shadow-chamber border border-chamber-gold/40 transition-colors uppercase tracking-wide text-sm"
        >
          {isSubmitting ? 'Saving your application...' : feeLabel ? `Continue to Secure Payment · ${feeLabel}` : 'Continue to Secure Payment'}
        </button>
        <p className="text-center text-[11px] text-gray-500">Next step: secure payment by card or digital wallet, processed by Stripe.</p>
      </form>
    </div>
  );
}
