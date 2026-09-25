'use client';

import React from 'react';

export default function ConfirmationPage() {
  return (
    <div className="bg-white rounded-xl shadow-chamber border border-chamber-gold/30 p-8 text-center max-w-2xl mx-auto space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-chamber-gold/20 text-chamber-black rounded-full text-3xl mx-auto border border-chamber-gold">
        ✓
      </div>

      <h2 className="text-3xl font-bold font-serif-brand text-chamber-black">Application Submitted!</h2>
      <p className="text-gray-600 text-base">
        Thank you for applying to be a vendor with the Weaverville Chamber of Commerce.
      </p>

      <div className="bg-chamber-black text-chamber-cream rounded-lg p-6 text-left space-y-3 border border-chamber-gold/40">
        <h3 className="font-bold font-serif-brand text-chamber-gold text-lg">What Happens Next?</h3>
        <ol className="list-decimal list-inside text-sm text-gray-200 space-y-2">
          <li><strong className="text-chamber-gold">Board Review:</strong> The Chamber Board of Directors has been notified of your application. Applications are reviewed to ensure booth variety and safety.</li>
          <li><strong className="text-chamber-gold">Timeline:</strong> Please allow <strong>3–5 business days</strong> for formal review.</li>
          <li><strong className="text-chamber-gold">Acceptance Notice:</strong> Once approved, you will receive an official email confirmation containing arrival, setup, and booth allocation details.</li>
        </ol>
      </div>

      <div className="pt-4 border-t border-chamber-gold/30 text-sm text-gray-600">
        <p>Have questions about your application?</p>
        <p className="font-semibold text-gray-900 mt-1">Contact Magdalena Elorriaga &bull; Phone: 909-963-6137</p>
      </div>
    </div>
  );
}
