import { NextResponse } from 'next/server';
import { esewaServerConfig, buildEsewaFormData, esewaFormBase } from '@/lib/payment/esewaServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orderId,
      orderNumber,
      totalAmount,
      taxAmount,
      productServiceCharge,
      productDeliveryCharge,
      successUrl,
      failureUrl,
    } = body;

    if (!orderId || !orderNumber || !totalAmount || !successUrl || !failureUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cfg = esewaServerConfig();
    if (!cfg.configured) {
      return NextResponse.json({ error: 'eSewa is not configured on the server' }, { status: 501 });
    }

    const formData = buildEsewaFormData(cfg, {
      totalAmount: Number(totalAmount),
      taxAmount: Number(taxAmount || 0),
      productServiceCharge: Number(productServiceCharge || 0),
      productDeliveryCharge: Number(productDeliveryCharge || 0),
      transactionUuid: orderId,
      productCode: cfg.productCode,
      successUrl,
      failureUrl,
    });

    const formBase = esewaFormBase(cfg);

    return NextResponse.json({
      configured: true,
      formBase,
      formData,
      transactionUuid: orderId,
    });
  } catch (error) {
    console.error('eSewa initiate error:', error);
    return NextResponse.json({ error: 'Failed to initiate eSewa payment' }, { status: 500 });
  }
}
