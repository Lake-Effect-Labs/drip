import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    // Verify the caller is a super admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await adminSupabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the target email from request body
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the target user profile
    const { data: targetProfile } = await adminSupabase
      .from("user_profiles")
      .select("id, email, full_name, is_affiliate")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "No user found with that email" },
        { status: 404 }
      );
    }

    const newAffiliateStatus = !targetProfile.is_affiliate;

    // Toggle the is_affiliate flag
    const { error: updateError } = await adminSupabase
      .from("user_profiles")
      .update({ is_affiliate: newAffiliateStatus })
      .eq("id", targetProfile.id);

    if (updateError) {
      console.error("Error toggling affiliate:", updateError);
      return NextResponse.json(
        { error: "Failed to update affiliate status" },
        { status: 500 }
      );
    }

    // If making them an affiliate and they don't have a creator code, create one
    if (newAffiliateStatus) {
      const { data: existingCode } = await adminSupabase
        .from("creator_codes")
        .select("id")
        .eq("user_id", targetProfile.id)
        .maybeSingle();

      if (!existingCode) {
        // Generate a default code from their name or email
        const baseName = (targetProfile.full_name || targetProfile.email.split("@")[0])
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 12);

        const code = baseName.length >= 3 ? baseName : `AFF${baseName}`;

        // Check if code is taken, add random suffix if needed
        const { data: takenCode } = await adminSupabase
          .from("creator_codes")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        const finalCode = takenCode
          ? `${code}${Math.floor(Math.random() * 999)}`
          : code;

        // Get global affiliate percentages from env (match self-serve defaults)
        const discountPercent = parseInt(process.env.AFFILIATE_DISCOUNT_PERCENT || "10", 10);
        const commissionPercent = parseInt(process.env.AFFILIATE_COMMISSION_PERCENT || "20", 10);

        await adminSupabase.from("creator_codes").insert({
          code: finalCode,
          creator_name: targetProfile.full_name || targetProfile.email,
          creator_email: targetProfile.email,
          user_id: targetProfile.id,
          discount_percent: discountPercent,
          commission_percent: commissionPercent,
        });
      } else {
        // Re-activate existing code if it was deactivated
        await adminSupabase
          .from("creator_codes")
          .update({ is_active: true })
          .eq("user_id", targetProfile.id);
      }
    } else {
      // Deactivate their creator code
      await adminSupabase
        .from("creator_codes")
        .update({ is_active: false })
        .eq("user_id", targetProfile.id);
    }

    return NextResponse.json({
      success: true,
      isAffiliate: newAffiliateStatus,
      email: targetProfile.email,
    });
  } catch (error) {
    console.error("Error toggling affiliate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
