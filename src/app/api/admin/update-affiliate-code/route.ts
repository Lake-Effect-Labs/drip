import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
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

    const body = await request.json();
    const { userId, newCode } = body;

    if (!userId || !newCode || typeof newCode !== "string") {
      return NextResponse.json(
        { error: "userId and newCode are required" },
        { status: 400 }
      );
    }

    const normalizedCode = newCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3 || normalizedCode.length > 20) {
      return NextResponse.json(
        { error: "Code must be 3-20 alphanumeric characters" },
        { status: 400 }
      );
    }

    // Check if code is taken by someone else
    const { data: takenCode } = await adminSupabase
      .from("creator_codes")
      .select("id, user_id")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (takenCode && takenCode.user_id !== userId) {
      return NextResponse.json(
        { error: "This code is already taken" },
        { status: 400 }
      );
    }

    // Update the code
    const { error } = await adminSupabase
      .from("creator_codes")
      .update({ code: normalizedCode, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating affiliate code:", error);
      return NextResponse.json(
        { error: "Failed to update code" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, code: normalizedCode });
  } catch (error) {
    console.error("Error updating affiliate code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
