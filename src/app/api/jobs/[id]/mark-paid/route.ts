import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Mark job as paid (uses admin client to bypass RLS)
export async function POST(
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

    const { id: jobId } = await params;
    const body = await request.json();
    const { paymentMethod } = body;

    // Get job to verify company
    const { data: job } = await adminSupabase
      .from("jobs")
      .select("company_id")
      .eq("id", jobId)
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

    const paidAt = new Date().toISOString();

    // Update job to paid status
    const { error: updateError } = await adminSupabase
      .from("jobs")
      .update({
        payment_state: "paid",
        payment_paid_at: paidAt,
        payment_method: paymentMethod,
        status: "paid",
        updated_at: paidAt,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Failed to mark job as paid:", updateError);
      return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paidAt,
    });
  } catch (error) {
    console.error("Error marking job as paid:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
