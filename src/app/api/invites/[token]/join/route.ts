import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const adminSupabase = createAdminClient();

  try {
    // Authenticate the caller — use session user, not client-supplied user_id
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user_id = user.id;
    const email = user.email!;
    const body = await request.json().catch(() => ({}));
    const { full_name } = body;

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
