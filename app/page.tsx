'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EVENTS, DEFAULT_EVENT_KEY, formatFee } from './lib/events';

export default function ApplicationPage() {
  const router = useRouter();
  const [selectedEventKey, setSelectedEventKey] = useState(DEFAULT_EVENT_KEY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentEvent = EVENTS[selectedEventKey];
  const feeLabel = formatFee(currentEvent.feeCents);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.liabilityAccepted) {
      alert('Please check the disclaimer of liability box to proceed.');
      return;
    }
    if (!formData.signatureName) {
      alert('Please provide an electronic signature.');
      return;
    }

    setIsSubmitting(true);

    const application = {
      ...formData,
      eventKey: selectedEventKey,
      eventName: currentEvent.name,
      eventDate: currentEvent.date,
      tagSlug: currentEvent.tagSlug,
      fee: currentEvent.feeCents / 100
    };

    // The payment step reads this to attach the vendor's contact details
    // to the Stripe customer and payment.
    const saveApplication = (ghlContactId: string | null) => {
      try {
        sessionStorage.setItem(
          'wcoc_vendor_application',
          JSON.stringify({ ...application, ghlContactId })
        );
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
        router.push(`/payment?event=${selectedEventKey}&email=${encodeURIComponent(formData.email)}`);
      } else {
        alert('There was an issue submitting your application. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      saveApplication(null);
      setIsSubmitting(false);
      router.push(`/payment?event=${selectedEventKey}&email=${encodeURIComponent(formData.email)}`);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-6 md:p-8">
      <h2 className="text-2xl font-bold font-serif-brand text-chamber-black mb-1 pb-3 border-b-2 border-chamber-gold/60">
        Official Event Vendor Application
      </h2>
      <p className="text-xs uppercase tracking-widest text-chamber-goldDeep font-semibold mt-2 mb-6">
        Weaverville Chamber of Commerce &middot; Est. 1909
      </p>

      <div className="mb-6 rounded-md border border-chamber-gold/40 bg-chamber-gold/10 p-4 text-sm text-gray-800 space-y-2">
        <p className="font-semibold text-chamber-black">
          Vendors wanted for {EVENTS[DEFAULT_EVENT_KEY].name}.
        </p>
        <p>
          Bring your crafts, gifts, food, or business to historic downtown Weaverville and meet shoppers from across Trinity County.
          Choose your event, fill out the form, and pay the application fee online. It takes about five minutes.
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
          <p><strong className="font-semibold text-chamber-gold">Vendor Application Fee:</strong> <span className="text-chamber-accent font-bold">{feeLabel}</span></p>
        </div>

        {/* Vendor Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Business / Vendor Name *</label>
            <input
              required
              type="text"
              value={formData.businessName}
              name="organization" autoComplete="organization" autoCapitalize="words"
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
              placeholder="e.g. Trinity Crafts & Gifts"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Contact Person Name *</label>
            <input
              required
              type="text"
              value={formData.contactName}
              name="name" autoComplete="name" autoCapitalize="words"
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone Number *</label>
            <input
              required
              type="tel"
              value={formData.phone}
              name="tel" autoComplete="tel" inputMode="tel"
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
              placeholder="(530) 000-0000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address *</label>
            <input
              required
              type="email"
              value={formData.email}
              name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mailing Address *</label>
          <input
            required
            type="text"
            value={formData.address}
              name="street-address" autoComplete="street-address"
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Street address, P.O. Box"
          />
        </div>

        {/* Product / Services Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Products / Services Description *</label>
          <textarea
            required
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Briefly describe what you will sell, display, or promote..."
          />
        </div>

        {/* Booth Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Booth Space Option *</label>
          <select
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
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Electronic Vendor Signature (Full Legal Name) *</label>
          <input
            required
            type="text"
            value={formData.signatureName}
              name="signature" autoComplete="off" autoCapitalize="words"
            onChange={(e) => setFormData({ ...formData, signatureName: e.target.value })}
            className="w-full border border-gray-300 rounded-md p-2.5 font-mono text-sm focus:ring-2 focus:ring-chamber-black focus:border-chamber-black"
            placeholder="Type your full legal name to sign"
          />
          <p className="text-[11px] text-gray-500 mt-1">By typing your name, you acknowledge this electronic signature as legally binding.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-chamber-black hover:bg-chamber-dark text-chamber-gold font-bold py-3 px-6 rounded-md shadow-chamber border border-chamber-gold/40 transition-colors uppercase tracking-wide text-sm"
        >
          {isSubmitting ? 'Submitting Application...' : `Submit Application & Proceed to Payment (${feeLabel})`}
        </button>
      </form>
    </div>
  );
}
