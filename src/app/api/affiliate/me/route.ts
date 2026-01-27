import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET - Get current user's affiliate info and their code
export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an affiliate
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("is_affiliate, email, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.is_affiliate) {
      return NextResponse.json({ isAffiliate: false });
    }

    // Get their creator code (if they have one)
    const { data: creatorCode } = await adminSupabase
      .from("creator_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get referral stats if they have a code
    let recentReferrals: { converted_at: string | null; created_at: string }[] = [];
    if (creatorCode) {
      const { data: referrals } = await adminSupabase
        .from("referrals")
        .select("converted_at, created_at")
        .eq("creator_code_id", creatorCode.id)
        .order("created_at", { ascending: false })
        .limit(10);

      recentReferrals = referrals || [];
    }

    return NextResponse.json({
      isAffiliate: true,
      profile: {
        email: profile.email,
        fullName: profile.full_name,
      },
      creatorCode: creatorCode
        ? {
            id: creatorCode.id,
            code: creatorCode.code,
            discountPercent: creatorCode.discount_percent,
            commissionPercent: creatorCode.commission_percent,
            totalReferrals: creatorCode.total_referrals,
            totalConversions: creatorCode.total_conversions,
            isActive: creatorCode.is_active,
            createdAt: creatorCode.created_at,
          }
        : null,
      recentReferrals,
    });
  } catch (error) {
    console.error("Error fetching affiliate info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new creator code for the affiliate
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an affiliate
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("is_affiliate, email, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.is_affiliate) {
      return NextResponse.json(
        { error: "You are not an affiliate" },
        { status: 403 }
      );
    }

    // Check if they already have a code
    const { data: existingCode } = await adminSupabase
      .from("creator_codes")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { error: "You already have a creator code" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, 3-20 chars)
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return NextResponse.json(
        { error: "Code must be 3-20 alphanumeric characters" },
        { status: 400 }
      );
    }

    // Check if code is already taken
    const { data: takenCode } = await adminSupabase
      .from("creator_codes")
      .select("id")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (takenCode) {
      return NextResponse.json(
        { error: "This code is already taken" },
        { status: 400 }
      );
    }

    // Get global affiliate percentages from env
    const discountPercent = parseInt(process.env.AFFILIATE_DISCOUNT_PERCENT || "10", 10);
    const commissionPercent = parseInt(process.env.AFFILIATE_COMMISSION_PERCENT || "20", 10);

    // Create the creator code
    const { data: newCode, error } = await adminSupabase
      .from("creator_codes")
      .insert({
        code: normalizedCode,
        creator_name: profile.full_name || profile.email,
        creator_email: profile.email,
        user_id: user.id,
        discount_percent: discountPercent,
        commission_percent: commissionPercent,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating creator code:", error);
      return NextResponse.json(
        { error: "Failed to create code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      creatorCode: {
        id: newCode.id,
        code: newCode.code,
        discountPercent: newCode.discount_percent,
        commissionPercent: newCode.commission_percent,
        totalReferrals: newCode.total_referrals,
        totalConversions: newCode.total_conversions,
        isActive: newCode.is_active,
      },
    });
  } catch (error) {
    console.error("Error creating affiliate code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update the affiliate's code
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an affiliate
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("is_affiliate")
      .eq("id", user.id)
      .single();

    if (!profile?.is_affiliate) {
      return NextResponse.json(
        { error: "You are not an affiliate" },
        { status: 403 }
      );
    }

    // Get their existing code
    const { data: existingCode } = await adminSupabase
      .from("creator_codes")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingCode) {
      return NextResponse.json(
        { error: "You don't have a creator code yet" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    // Validate code format
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return NextResponse.json(
        { error: "Code must be 3-20 alphanumeric characters" },
        { status: 400 }
      );
    }

    // Check if new code is already taken (by someone else)
    const { data: takenCode } = await adminSupabase
      .from("creator_codes")
      .select("id")
      .eq("code", normalizedCode)
      .neq("id", existingCode.id)
      .maybeSingle();

    if (takenCode) {
      return NextResponse.json(
        { error: "This code is already taken" },
        { status: 400 }
      );
    }

    // Update the code
    const { data: updatedCode, error } = await adminSupabase
      .from("creator_codes")
      .update({ code: normalizedCode, updated_at: new Date().toISOString() })
      .eq("id", existingCode.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating creator code:", error);
      return NextResponse.json(
        { error: "Failed to update code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      creatorCode: {
        id: updatedCode.id,
        code: updatedCode.code,
        discountPercent: updatedCode.discount_percent,
        commissionPercent: updatedCode.commission_percent,
        totalReferrals: updatedCode.total_referrals,
        totalConversions: updatedCode.total_conversions,
        isActive: updatedCode.is_active,
      },
    });
  } catch (error) {
    console.error("Error updating affiliate code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
