import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  status: string;
  trialEndsAt: string | null;
}

/**
 * Check if a company's subscription allows access.
 * Active subscriptions and non-expired trials are allowed.
 * Returns null if allowed, or a 402 response if blocked.
 */
export async function requireActiveSubscription(
  companyId: string
): Promise<NextResponse | null> {
  const adminSupabase = createAdminClient();

  const { data: company } = await adminSupabase
    .from("companies")
    .select("subscription_status, trial_ends_at")
    .eq("id", companyId)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const status = company.subscription_status || "trialing";

  // Active and past_due subscriptions are allowed (past_due gets a grace period from Stripe)
  if (status === "active" || status === "past_due") {
    return null;
  }

  // Trial: check if it has expired
  if (status === "trialing") {
    const trialEnd = company.trial_ends_at
      ? new Date(company.trial_ends_at)
      : null;

    if (trialEnd && trialEnd > new Date()) {
      // Trial still active
      return null;
    }

    // Trial expired
    return NextResponse.json(
      {
        error: "Trial expired",
        message: "Your free trial has ended. Subscribe to continue using Matte.",
        code: "TRIAL_EXPIRED",
      },
      { status: 402 }
    );
  }

  // Canceled, incomplete, or unknown — blocked
  return NextResponse.json(
    {
      error: "Subscription required",
      message: "An active subscription is required to use this feature.",
      code: "SUBSCRIPTION_REQUIRED",
    },
    { status: 402 }
  );
}

/**
 * Get subscription status for a company (for UI display, not gating).
 */
export async function getSubscriptionStatus(
  companyId: string
): Promise<SubscriptionStatus> {
  const adminSupabase = createAdminClient();

  const { data: company } = await adminSupabase
    .from("companies")
    .select("subscription_status, trial_ends_at")
    .eq("id", companyId)
    .single();

  const status = company?.subscription_status || "trialing";
  const trialEndsAt = company?.trial_ends_at || null;
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;

  const isActive = status === "active" || status === "past_due";
  const isTrial = status === "trialing";
  const isExpired =
    (isTrial && trialEnd !== null && trialEnd <= new Date()) ||
    status === "canceled" ||
    status === "incomplete";

  return { isActive, isTrial, isExpired, status, trialEndsAt };
}
