import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
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
    console.error("Webhook signature verification failed:", err);
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
        const invoiceId = session.metadata?.invoice_id;

        if (!invoiceId) {
          console.error("No invoice_id in session metadata");
          break;
        }

        // Get the invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoice) {
          console.error("Invoice not found:", invoiceId);
          break;
        }

        // Update invoice to paid
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        if (updateError) {
          console.error("Error updating invoice:", updateError);
          break;
        }

        // Create payment record
        const { error: paymentError } = await supabase
          .from("invoice_payments")
          .insert({
            invoice_id: invoiceId,
            stripe_payment_intent_id: session.payment_intent as string,
            amount: session.amount_total || invoice.amount_total,
            paid_at: new Date().toISOString(),
          });

        if (paymentError) {
          console.error("Error creating payment record:", paymentError);
        }

        // Update job status to paid
        if (invoice.job_id) {
          const { error: jobError } = await supabase
            .from("jobs")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.job_id);

          if (jobError) {
            console.error("Error updating job status:", jobError);
          }
        }

        console.log(`Invoice ${invoiceId} marked as paid`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;

        if (invoiceId) {
          // Clear the checkout URL so a new one can be generated
          await supabase
            .from("invoices")
            .update({
              stripe_checkout_url: null,
              stripe_checkout_session_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);

          console.log(`Checkout session expired for invoice ${invoiceId}`);
        }
        break;
      }
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

