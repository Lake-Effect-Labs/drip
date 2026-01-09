import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const adminSupabase = createAdminClient();

  try {
    const body = await request.json();
    const { user_id, email, full_name } = body;

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the user exists in auth
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(user_id);
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Invalid user" },
        { status: 400 }
      );
    }

    // Get invite
    const { data: invite, error: inviteError } = await adminSupabase
      .from("invite_links")
      .select("company_id")
      .eq("token", token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if user already in company
    const { data: existing } = await adminSupabase
      .from("company_users")
      .select("id")
      .eq("user_id", user_id)
      .eq("company_id", invite.company_id)
      .single();

    if (existing) {
      return NextResponse.json({ success: true, message: "Already a member" });
    }

    // Create user profile
    await adminSupabase.from("user_profiles").upsert({
      id: user_id,
      email,
      full_name: full_name || null,
    });

    // Add user to company
    const { error: joinError } = await adminSupabase.from("company_users").insert({
      company_id: invite.company_id,
      user_id,
    });

    if (joinError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error joining company:", joinError);
      }
      return NextResponse.json(
        { error: "Failed to join company" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error processing invite:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
