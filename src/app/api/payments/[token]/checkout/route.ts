import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { env } from "@/lib/env";

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    // Get job by payment_token
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("payment_token", token)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Check if already paid
    if (job.payment_state === "paid") {
      return NextResponse.json(
        { error: "Payment already completed" },
        { status: 400 }
      );
    }

    // Get company info
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", job.company_id)
      .single();

    // Fetch payment line items to calculate total if payment_amount not set
    let amount = job.payment_amount;
    if (!amount || amount <= 0) {
      const { data: lineItems } = await supabase
        .from("job_payment_line_items")
        .select("price")
        .eq("job_id", job.id);
      
      amount = lineItems?.reduce((sum: number, item: { price: number }) => sum + item.price, 0) || 0;
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: job.title || "Job Payment",
              description: company?.name ? `Payment for ${company.name}` : "Job payment",
            },
            unit_amount: amount, // amount is already in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env.appUrl}/p/${token}?success=true`,
      cancel_url: `${env.appUrl}/p/${token}?canceled=true`,
      metadata: {
        job_id: job.id,
        payment_token: token,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe checkout:", error);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}
