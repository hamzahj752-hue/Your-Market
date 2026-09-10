import { NextResponse } from 'next/server';
import { esewaServerConfig } from '@/lib/payment/esewaServer';

/**
 * Returns the NON-SECRET configuration status of eSewa so the storefront can
 * decide whether to offer eSewa at checkout. Never returns the secret key.
 */
export async function GET() {
  const cfg = esewaServerConfig();
  return NextResponse.json({
    provider: 'esewa',
    configured: cfg.configured,
    environment: cfg.environment,
    displayName: cfg.displayName,
  });
}
