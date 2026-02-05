import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripeOrNull } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Subscription price (monthly) for commission calculation
const SUBSCRIPTION_PRICE_CENTS = parseInt(
  process.env.STRIPE_SUBSCRIPTION_PRICE_CENTS || "2900"
); // Default $29

export async function POST(request: Request) {
  const stripe = getStripeOrNull();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  // Get raw body (NOT parsed JSON)
  const body = await request.text();

  // Get signature header
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Verify the webhook is actually from Stripe
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Atomic idempotency: INSERT and catch PK conflict to avoid TOCTOU race
  const { error: idempotencyError } = await supabase
    .from("webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    });

  if (idempotencyError) {
    // PK conflict (code 23505) means we already processed this event
    if (idempotencyError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Error recording webhook event:", idempotencyError);
  }

  try {
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Check if this is a subscription checkout (has company_id in metadata)
        if (session.metadata?.company_id && session.mode === "subscription") {
          const companyId = session.metadata.company_id;
          const userId = session.metadata.user_id;
          const creatorCodeId = session.metadata.creator_code_id;
          const visitorId = session.metadata.visitor_id;

          // Update company subscription status
          const { error: companyError } = await supabase
            .from("companies")
            .update({
              subscription_id: session.subscription as string,
              subscription_status: "active",
            })
            .eq("id", companyId);

          if (companyError) {
            console.error("Error updating company subscription:", companyError);
          }

          // Handle affiliate conversion if there's a creator code
          if (creatorCodeId && visitorId) {
            // Get the creator code to calculate commission
            const { data: creatorCode } = await supabase
              .from("creator_codes")
              .select("commission_percent, total_conversions")
              .eq("id", creatorCodeId)
              .single();

            if (creatorCode) {
              // Calculate commission (percentage of monthly price)
              const commissionOwed =
                (SUBSCRIPTION_PRICE_CENTS * creatorCode.commission_percent) /
                100 /
                100; // Convert cents to dollars

              // Update the referral record
              const { error: referralError } = await supabase
                .from("referrals")
                .update({
                  converted_at: new Date().toISOString(),
                  subscriber_user_id: userId,
                  subscriber_company_id: companyId,
                  commission_owed: commissionOwed,
                })
                .eq("creator_code_id", creatorCodeId)
                .eq("visitor_id", visitorId)
                .is("converted_at", null);

              if (referralError) {
                console.error("Error updating referral:", referralError);
              }

              // Atomic increment of total_conversions (avoids race conditions)
              await supabase.rpc("increment_total_conversions", {
                code_id: creatorCodeId,
              });
            }
          }
        }

        // Also handle job payments (from previous implementation)
        if (session.metadata?.job_id && session.payment_status === "paid") {
          const { error } = await supabase
            .from("jobs")
            .update({
              payment_state: "paid",
              payment_paid_at: new Date().toISOString(),
              payment_method: "stripe",
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.metadata.job_id);

          if (error) {
            console.error("Error updating job payment from Stripe:", error);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const companyId = subscription.metadata?.company_id;

        if (companyId) {
          // subscription.status and subscription.current_period_end are available
          const periodEnd = (subscription as any).current_period_end;
          const { error } = await supabase
            .from("companies")
            .update({
              subscription_status: subscription.status,
              subscription_current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("id", companyId);

          if (error) {
            console.error("Error updating subscription status:", error);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const companyId = subscription.metadata?.company_id;

        if (companyId) {
          const { error } = await supabase
            .from("companies")
            .update({
              subscription_status: "canceled",
              subscription_id: null,
            })
            .eq("id", companyId);

          if (error) {
            console.error("Error handling subscription deletion:", error);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.error("Payment failed for invoice:", (invoice as any).id);
        // Update company to past_due so the UI can show a warning
        const failedSubscriptionId = (invoice as any).subscription;
        if (failedSubscriptionId) {
          const { error } = await supabase
            .from("companies")
            .update({ subscription_status: "past_due" })
            .eq("subscription_id", failedSubscriptionId);
          if (error) {
            console.error("Error updating company for failed payment:", error);
          }
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
