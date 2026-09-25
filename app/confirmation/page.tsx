
'use client';



import React from 'react';



export default function ConfirmationPage() {

  return (

    <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-2xl mx-auto space-y-6">

      <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full text-3xl mx-auto">

        ✓

      </div>



      <h2 className="text-3xl font-bold text-[#1b4332]">Application Submitted!</h2>

      <p className="text-gray-600 text-base">

        Thank you for applying to be a vendor with the Weaverville Chamber of Commerce.

      </p>



      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-left space-y-3">

        <h3 className="font-bold text-emerald-900 text-lg">What Happens Next?</h3>

        <ol className="list-decimal list-inside text-sm text-emerald-800 space-y-2">

          <li><strong>Board Review:</strong> The Chamber Board of Directors has been notified of your application. Applications are reviewed to ensure booth variety and safety.</li>

          <li><strong>Timeline:</strong> Please allow <strong>3–5 business days</strong> for formal review.</li>

          <li><strong>Acceptance Notice:</strong> Once approved, you will receive an official email confirmation containing arrival, setup, and booth allocation details.</li>

        </ol>

      </div>



      <div className="pt-4 border-t border-gray-200 text-sm text-gray-600">

        <p>Have questions about your application?</p>

        <p className="font-semibold text-gray-900 mt-1">Contact Magdalena Elorriaga • Phone: 909-963-6137</p>

      </div>

    </div>

  );

}

