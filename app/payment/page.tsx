
'use client';



import React, { Suspense } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';



function PaymentContent() {

  const searchParams = useSearchParams();

  const router = useRouter();

  const email = searchParams.get('email') || '';



  const handlePayment = () => {

    // Navigates to confirmation page

    router.push(`/confirmation?email=${encodeURIComponent(email)}`);

  };



  return (

    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 text-center max-w-xl mx-auto space-y-6">

      <div className="inline-block p-3 bg-amber-100 text-amber-800 rounded-full">

        💳

      </div>

      <h2 className="text-2xl font-bold text-gray-900">Vendor Fee Payment</h2>

      <p className="text-gray-600 text-sm">

        Your application has been received! Please complete the <strong>$20.00 Vendor Application Fee</strong> to finalize your submission for Board review.

      </p>



      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm space-y-2">

        <div className="flex justify-between border-b pb-2">

          <span className="text-gray-600">Application Item:</span>

          <span className="font-semibold text-gray-900">WCoC Event Vendor Fee</span>

        </div>

        <div className="flex justify-between pt-1 text-base font-bold text-[#1b4332]">

          <span>Total Due:</span>

          <span>$20.00</span>

        </div>

      </div>



      <button

        onClick={handlePayment}

        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-md shadow transition-colors"

      >

        Complete $20.00 Payment

      </button>



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

