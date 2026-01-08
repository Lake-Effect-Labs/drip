import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Check if user has a company (uses admin client to bypass RLS)
export async function GET() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasCompany: false }, { status: 401 });
    }

    // Use admin client to check (bypasses RLS)
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyUser) {
      return NextResponse.json({ hasCompany: true, companyId: companyUser.company_id });
    }

    // Check if they have an orphaned company
    const { data: company } = await adminSupabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (company) {
      // Auto-link them
      await adminSupabase.from("company_users").insert({
        company_id: company.id,
        user_id: user.id,
      });

      return NextResponse.json({ hasCompany: true, companyId: company.id });
    }

    return NextResponse.json({ hasCompany: false });
  } catch (error) {
    console.error("Error checking company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
