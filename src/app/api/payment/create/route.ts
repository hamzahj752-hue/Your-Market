import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const amount = Number(body?.amount);
    const identifier = String(body?.identifier || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment amount.' },
        { status: 400 }
      );
    }

    if (!identifier) {
      return NextResponse.json(
        { success: false, message: 'Payment identifier is required.' },
        { status: 400 }
      );
    }

    const secretKey = process.env.APINepal_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { success: false, message: 'APINepal secret key is not configured.' },
        { status: 500 }
      );
    }

    const response = await fetch('https://apinepal.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'NPR',
        identifier,
        description: String(body?.description || 'YourMarket Payment'),
      }),
    });

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('APINepal payment create error:', error);

    return NextResponse.json(
      { success: false, message: 'Unable to create payment.' },
      { status: 500 }
    );
  }
}
