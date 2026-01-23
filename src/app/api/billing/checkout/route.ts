import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Check Stripe configuration
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Subscription price not configured" },
      { status: 503 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company for this user
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyUser) {
      return NextResponse.json(
        { error: "No company found for user" },
        { status: 404 }
      );
    }

    const { data: company } = await adminSupabase
      .from("companies")
      .select("*")
      .eq("id", companyUser.company_id)
      .single();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check if already subscribed
    if ((company as any).subscription_status === "active") {
      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 400 }
      );
    }

    // Parse request body for referral info
    const body = await request.json().catch(() => ({}));
    const { referralCode, visitorId } = body;

    // Look up referral discount if code provided
    let discountPercent = 0;
    let creatorCodeId: string | null = null;

    if (referralCode) {
      const { data: creatorCode } = await adminSupabase
        .from("creator_codes")
        .select("*")
        .eq("code", referralCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (creatorCode) {
        discountPercent = creatorCode.discount_percent;
        creatorCodeId = creatorCode.id;
      }
    }

    // Create or get Stripe customer
    let stripeCustomerId = (company as any).stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          company_id: company.id,
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to database
      await adminSupabase
        .from("companies")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", company.id);
    }

    // Create coupon if there's a referral discount
    let discounts: { coupon: string }[] = [];
    if (discountPercent > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "once",
        metadata: {
          creator_code_id: creatorCodeId || "",
          referral_code: referralCode || "",
        },
      });
      discounts = [{ coupon: coupon.id }];
    }

    // Build success/cancel URLs - use request origin as fallback
    const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin || "https://matte.biz";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      discounts,
      success_url: `${appUrl}/app/board?billing=success`,
      cancel_url: `${appUrl}/app/settings?billing=canceled`,
      metadata: {
        company_id: company.id,
        user_id: user.id,
        creator_code_id: creatorCodeId || "",
        visitor_id: visitorId || "",
      },
      subscription_data: {
        metadata: {
          company_id: company.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
