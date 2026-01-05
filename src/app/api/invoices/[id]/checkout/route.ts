import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    // Verify user has access to this invoice
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company ID
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyUser.company_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get job and customer
    const { data: job } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", invoice.job_id)
      .single();

    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", invoice.customer_id)
      .single();

    // If already has checkout session, return existing
    if (invoice.stripe_checkout_url) {
      return NextResponse.json({
        checkout_url: invoice.stripe_checkout_url,
        session_id: invoice.stripe_checkout_session_id,
      });
    }

    // Create Stripe Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl}/i/${invoice.public_token}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice for ${job?.title || "Project"}`,
              description: customer?.name || undefined,
            },
            unit_amount: invoice.amount_total,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${publicUrl}?success=true`,
      cancel_url: `${publicUrl}?canceled=true`,
      metadata: {
        invoice_id: invoice.id,
        company_id: invoice.company_id,
      },
    });

    // Update invoice with checkout session info
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_checkout_url: session.url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
    }

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

