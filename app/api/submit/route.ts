
import { NextResponse } from 'next/server';



export async function POST(req: Request) {

  try {

    const body = await req.json();



    const locationId = process.env.GHL_LOCATION_ID || 'ltcv3MxZCgXvlwLhieDR';

    const apiKey = *** || process.env.GHL_API_KEY || '';



    if (apiKey) {

      const ghlPayload = {

        locationId,

        email: body.email,

        phone: body.phone,

        firstName: body.contactName.split(' ')[0] || body.contactName,

        lastName: body.contactName.split(' ').slice(1).join(' ') || '',

        companyName: body.businessName,

        address1: body.address,

        city: body.city || 'Weaverville',

        state: body.state || 'CA',

        postalCode: body.zip || '96093',

        tags: [

          'wcoc - vendor-app - submitted',

          'action - vendor-app - payment-pending',

          `campaign - ${body.tagSlug || 'witches-brigade-2026'} - vendor`

        ]

      };



      await fetch('https://services.leadconnectorhq.com/contacts/upsert', {

        method: 'POST',

        headers: {

          'Authorization': `Bearer ***}`,

          'Version': '2021-07-28',

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(ghlPayload)

      });

    }



    return NextResponse.json({ success: true });

  } catch (err: any) {

    console.error('Error in /api/submit:', err);

    return NextResponse.json({ success: false, error: err.message }, { status: 500 });

  }

}

