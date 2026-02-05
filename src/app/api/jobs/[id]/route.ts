import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/subscription";

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

    const subCheck = await requireActiveSubscription(job.company_id);
    if (subCheck) return subCheck;

    // Whitelist allowed fields to prevent mass assignment of sensitive fields
    // like company_id, unified_job_token, etc.
    const allowedFields = [
      'title', 'address1', 'address2', 'city', 'state', 'zip', 'notes',
      'status', 'assigned_user_id', 'customer_id', 'scheduled_date',
      'scheduled_time', 'payment_state', 'payment_amount', 'payment_method',
      'payment_paid_at', 'progress_percentage', 'sort_order',
    ];
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    // Update job (using admin client to bypass RLS)
    const { data: updatedJob, error: updateError } = await adminSupabase
      .from("jobs")
      .update({
        ...sanitizedBody,
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

// Delete job and all related data
export async function DELETE(
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

    // Get job to verify company
    const { data: job } = await adminSupabase
      .from("jobs")
      .select("company_id, status")
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

    // Don't allow deleting paid jobs (financial record)
    if (job.status === "paid") {
      return NextResponse.json(
        { error: "Cannot delete a paid job. Archive it instead." },
        { status: 400 }
      );
    }

    // Delete job — cascades to estimates, photos, line items, materials via FK constraints
    const { error: deleteError } = await adminSupabase
      .from("jobs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting job:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in job deletion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
