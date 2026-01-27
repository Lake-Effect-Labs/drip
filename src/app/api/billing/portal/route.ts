import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

    // Get company for this user (use limit(1) to avoid crash if user is in multiple companies)
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "No company found for user" },
        { status: 404 }
      );
    }

    const { data: company } = await adminSupabase
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyUser.company_id)
      .single();

    if (!(company as any)?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 }
      );
    }

    // Build return URL - use request origin as fallback
    const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin || "https://matte.biz";

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: (company as any).stripe_customer_id,
      return_url: `${appUrl}/app/board`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
