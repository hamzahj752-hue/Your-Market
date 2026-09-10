import { NextResponse } from 'next/server';
import { esewaServerConfig, esewaVerifyStatus } from '@/lib/payment/esewaServer';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionUuid = searchParams.get('transaction_uuid');
    const totalAmount = searchParams.get('total_amount');
    const productCode = searchParams.get('product_code');
    const status = searchParams.get('status');
    const transactionDate = searchParams.get('transaction_date');

    if (!transactionUuid || !totalAmount || !productCode) {
      return NextResponse.redirect(new URL('/checkout?payment=invalid', request.url));
    }

    const cfg = esewaServerConfig();
    if (!cfg.configured) {
      return NextResponse.redirect(new URL('/checkout?payment=error', request.url));
    }

    // If eSewa returned a clear failure status, no need to verify
    if (status && status !== 'COMPLETE') {
      return NextResponse.redirect(new URL('/checkout?payment=failed', request.url));
    }

    // Verify the transaction with eSewa server
    let verification: Record<string, unknown>;
    try {
      verification = await esewaVerifyStatus(cfg, {
        totalAmount: Number(totalAmount),
        transactionUuid,
        productCode,
        transactionDate: transactionDate || new Date().toISOString(),
      });
    } catch (verifyError) {
      console.error('eSewa verification failed:', verifyError);
      return NextResponse.redirect(new URL('/checkout?payment=verification_failed', request.url));
    }

    const verifiedStatus = (verification as Record<string, unknown>).status;
    if (verifiedStatus !== 'COMPLETE') {
      return NextResponse.redirect(new URL('/checkout?payment=failed', request.url));
    }

    // Update order payment status
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: 'esewa',
      })
      .eq('id', transactionUuid)
      .select('order_type')
      .maybeSingle();

    if (updateError) {
      console.error('Failed to update order payment status:', updateError);
    }

    // Redirect based on order type
    const isFoodOrder = (order as Record<string, unknown> | null)?.order_type === 'food';
    if (isFoodOrder) {
      return NextResponse.redirect(new URL('/account/food-orders?payment=success', request.url));
    }
    return NextResponse.redirect(new URL('/account/orders?payment=success', request.url));
  } catch (error) {
    console.error('eSewa callback error:', error);
    return NextResponse.redirect(new URL('/checkout?payment=error', request.url));
  }
}
