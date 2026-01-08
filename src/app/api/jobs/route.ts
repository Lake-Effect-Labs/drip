import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Create job (uses admin client to bypass RLS)
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

    const body = await request.json();
    const {
      company_id,
      customer_id,
      title,
      address1,
      address2,
      city,
      state,
      zip,
      notes,
      assigned_user_id,
      status = "new",
    } = body;

    if (!company_id || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify user belongs to company (using admin client)
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "Unauthorized - not a member of this company" },
        { status: 403 }
      );
    }

    // Create job (using admin client to bypass RLS)
    const { data: job, error: jobError } = await adminSupabase
      .from("jobs")
      .insert({
        company_id,
        customer_id: customer_id || null,
        title: title.trim(),
        address1: address1 || null,
        address2: address2 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        notes: notes || null,
        assigned_user_id: assigned_user_id || null,
        status,
      })
      .select("*, customer:customers(*)")
      .single();

    if (jobError) {
      console.error("Error creating job:", jobError);
      return NextResponse.json(
        { error: jobError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error in job creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
