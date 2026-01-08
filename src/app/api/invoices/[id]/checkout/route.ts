// DISABLED: Customer payment processing removed for Drip-lite
// This route is kept for future SaaS billing (charging painters for Drip subscription)
// 
// For Drip-lite: Painters mark jobs as "Paid" manually (cash, check, Venmo, etc.)
// No money flows through Drip for customer payments.

import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: "Customer payment processing is not available" },
    { status: 410 } // 410 Gone - feature removed
  );
}

// FUTURE: SaaS Billing Implementation
// When ready to charge painters for Drip subscription:
// 1. Create Stripe Checkout session for subscription
// 2. Store subscription_id in companies table
// 3. Use webhook to handle subscription events
// 4. Enforce feature limits based on subscription tier
