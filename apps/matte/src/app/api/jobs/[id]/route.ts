import { NextResponse } from "next/server";
import { createAdminClient } from "@drip/core/database/server";
import { createClient } from "@drip/core/database/server";

// Update job (uses admin client to bypass RLS)
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

    // Get job to verify company
    const { data: job } = await adminSupabase
      .from("jobs")
      .select("company_id")
      .eq("id", id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify user belongs to company
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", job.company_id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json(
        { error: "Unauthorized - not a member of this company" },
        { status: 403 }
      );
    }

    // Update job (using admin client to bypass RLS)
    const { data: updatedJob, error: updateError } = await adminSupabase
      .from("jobs")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating job:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to update job" },
        { status: 500 }
      );
    }

    // Fetch customer separately if exists
    let customer = null;
    if (updatedJob.customer_id) {
      const { data: customerData } = await adminSupabase
        .from("customers")
        .select("*")
        .eq("id", updatedJob.customer_id)
        .maybeSingle();
      customer = customerData;
    }

    return NextResponse.json({ ...updatedJob, customer });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error in job update:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
