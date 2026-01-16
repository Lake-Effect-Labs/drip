import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@drip/core/database/server";

// API route to link user to company (requires authentication)
export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    // Verify the requester is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { company_id, user_id } = body;

    if (!company_id || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Security: Only allow linking if requester is already a member of the company
    // OR if the requester is the company owner linking themselves
    const { data: requesterMembership } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .maybeSingle();

    const { data: company } = await adminSupabase
      .from("companies")
      .select("owner_user_id")
      .eq("id", company_id)
      .single();

    // Allow if: requester is already a member, OR requester owns the company and is linking themselves
    const isCompanyMember = !!requesterMembership;
    const isOwnerLinkingSelf = company?.owner_user_id === user.id && user_id === user.id;

    if (!isCompanyMember && !isOwnerLinkingSelf) {
      return NextResponse.json(
        { error: "Forbidden - not authorized to add members to this company" },
        { status: 403 }
      );
    }

    // Insert company_users link (admin client bypasses RLS)
    const { error: linkError } = await adminSupabase
      .from("company_users")
      .insert({
        company_id,
        user_id,
      });

    if (linkError) {
      // If already exists, that's fine
      if (linkError.code === "23505") {
        return NextResponse.json({ success: true });
      }
      if (process.env.NODE_ENV === "development") {
        console.error("Error linking user to company:", linkError);
      }
      return NextResponse.json(
        { error: "Failed to link user to company" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in company link:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
