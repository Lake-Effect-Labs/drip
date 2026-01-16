import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@drip/core/database/server";

// Stripe is optional for local testing (only needed for future SaaS billing)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/**
 * Stripe Webhook Handler
 * 
 * DISABLED: Customer payment processing removed for Drip-lite
 * Painters mark jobs as "Paid" manually (cash, check, Venmo, etc.)
 * 
 * FUTURE: SaaS Billing
 * When ready to charge painters for Drip subscription:
 * - Handle checkout.session.completed for subscription checkout
 * - Handle customer.subscription.* events
 * - Update companies.subscription_status
 */
export async function POST(request: Request) {
  // Stripe is optional for local testing
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("Webhook signature verification failed:", err);
    }
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is a job payment (has job_id in metadata)
        if (session.metadata?.job_id && session.payment_status === "paid") {
          const { error } = await supabase
            .from("jobs")
            .update({
              payment_state: "paid",
              payment_paid_at: new Date().toISOString(),
              payment_method: "stripe",
              status: "paid", // Also update job status to move card to paid column
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.metadata.job_id);

          if (error) {
            console.error("Error updating job payment from Stripe:", error);
          }
        }
        break;
      }
      // FUTURE: SaaS billing - subscription checkout
      case "checkout.session.completed": {
        // TODO: Handle subscription checkout for SaaS billing
        // const session = event.data.object as Stripe.Checkout.Session;
        // const companyId = session.metadata?.company_id;
        // Update company subscription status
        break;
      }

      // FUTURE: SaaS billing - subscription events
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // TODO: Handle subscription lifecycle
        break;
      }

      default:
        // Ignore other events for now
        break;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error processing webhook:", error);
    }
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
