import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    const { data: invite, error } = await supabase
      .from("invite_links")
      .select("*")
      .eq("token", token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !invite) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    // Get company name
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", invite.company_id)
      .single();

    return NextResponse.json({
      valid: true,
      company_name: company?.name,
      expires_at: invite.expires_at,
    });
  } catch (error) {
    console.error("Error checking invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

