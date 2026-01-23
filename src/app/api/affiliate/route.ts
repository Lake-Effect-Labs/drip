import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET - Validate a referral code
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: creatorCode } = await supabase
    .from("creator_codes")
    .select("code, creator_name, discount_percent")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!creatorCode) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    code: creatorCode.code,
    creatorName: creatorCode.creator_name,
    discountPercent: creatorCode.discount_percent,
  });
}

// POST - Track a referral visit
export async function POST(request: Request) {
  const body = await request.json();
  const { code, visitorId } = body;

  if (!code || !visitorId) {
    return NextResponse.json(
      { error: "Code and visitorId are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Look up the creator code
  const { data: creatorCode } = await supabase
    .from("creator_codes")
    .select("id")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!creatorCode) {
    return NextResponse.json({ error: "Invalid code" }, { status: 404 });
  }

  // Check if this visitor already has a referral for this code
  const { data: existingReferral } = await supabase
    .from("referrals")
    .select("id")
    .eq("creator_code_id", creatorCode.id)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (existingReferral) {
    // Already tracked, just return success
    return NextResponse.json({ success: true, alreadyTracked: true });
  }

  // Create new referral record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiry

  const { error } = await supabase.from("referrals").insert({
    creator_code_id: creatorCode.id,
    visitor_id: visitorId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("Error creating referral:", error);
    return NextResponse.json(
      { error: "Failed to track referral" },
      { status: 500 }
    );
  }

  // Note: total_referrals is auto-incremented by the database trigger

  return NextResponse.json({ success: true });
}
