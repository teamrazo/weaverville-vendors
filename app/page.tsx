'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const EVENTS = {
  witches_brigade: {
    id: 'witches_brigade',
    name: 'Weaverville 8th Annual Witches Brigade',
    date: 'October 17, 2026',
    time: '10:00 AM – 5:00 PM (Setup before 10:00 AM)',
    fee: '$20.00',
    booths: ['Outdoor 10x10 (Near Visitor Center)', 'Table Space (Positioned near businesses)'],
    tagSlug: 'witches-brigade-2026'
  },
  mountain_magic: {
    id: 'mountain_magic',
    name: 'Mountain Magic Christmas',
    date: 'December 2026 (TBD)',
    time: 'TBD',
    fee: '$20.00',
    booths: ['Indoor Hall Space', 'Outdoor Booth Space'],
    tagSlug: 'mountain-magic-2026'
  },
  july_4th_fireworks: {
    id: 'july_4th_fireworks',
    name: '4th Of July Fireworks & Festival',
    date: 'July 4, 2026',
    time: '12:00 PM – 9:00 PM',
    fee: '$20.00',
    booths: ['Standard Vendor Plot (10x10)', 'Food/Beverage Truck Spot'],
    tagSlug: '4th-july-fireworks-2026'
  }
};

export default function ApplicationPage() {
  const router = useRouter();
  const [selectedEventKey, setSelectedEventKey] = useState('witches_brigade');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentEvent = EVENTS[selectedEventKey as keyof typeof EVENTS];

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
    signatureName: ''
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

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          eventKey: selectedEventKey,
          eventName: currentEvent.name,
          eventDate: currentEvent.date,
          tagSlug: currentEvent.tagSlug,
          fee: 20.00
        })
      });

      if (res.ok) {
        router.push(`/payment?event=${selectedEventKey}&email=${encodeURIComponent(formData.email)}`);
      } else {
        alert('There was an issue submitting your application. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Selection Dropdown */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Event *</label>
          <select
            value={selectedEventKey}
            onChange={(e) => {
              const k = e.target.value;
              setSelectedEventKey(k);
              setFormData(prev => ({ ...prev, boothType: EVENTS[k as keyof typeof EVENTS].booths[0] }));
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
          <p><strong className="font-semibold text-chamber-gold">Vendor Application Fee:</strong> <span className="text-chamber-accent font-bold">{currentEvent.fee}</span></p>
        </div>

        {/* Vendor Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Business / Vendor Name *</label>
            <input
              required
              type="text"
              value={formData.businessName}
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
              className="h-4 w-4 text-chamber-black rounded border-gray-300 focus:ring-chamber-gold"
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
          {isSubmitting ? 'Submitting Application...' : `Submit Application & Proceed to Payment (${currentEvent.fee})`}
        </button>
      </form>
    </div>
  );
}
