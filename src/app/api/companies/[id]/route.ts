import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Update company (uses admin client to bypass RLS)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify user belongs to company
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "Unauthorized - not a member of this company" },
        { status: 403 }
      );
    }

    // Whitelist allowed fields to prevent mass assignment of sensitive fields
    // like owner_user_id, subscription_status, stripe_customer_id, etc.
    const allowedFields = ['name', 'logo_url', 'phone', 'email', 'address1', 'address2', 'city', 'state', 'zip', 'website', 'theme_id'];
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    // Update company (using admin client to bypass RLS)
    const { data: updatedCompany, error: updateError } = await adminSupabase
      .from("companies")
      .update(sanitizedBody)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating company:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to update company" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCompany);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in company update:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
