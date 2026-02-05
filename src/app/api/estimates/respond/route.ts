import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/estimates/respond
 * Public endpoint for customers to accept or deny an estimate via their portal token.
 * No auth required — token acts as authorization.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, action, denialReason } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (action !== "accept" && action !== "deny") {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'deny'" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Find the job by its unified_job_token
    const { data: job } = await adminSupabase
      .from("jobs")
      .select("id, company_id")
      .eq("unified_job_token", token)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Find the active (most recent sent) estimate for this job
    const { data: estimate } = await adminSupabase
      .from("estimates")
      .select("id, status")
      .eq("job_id", job.id)
      .in("status", ["sent", "draft"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!estimate) {
      return NextResponse.json(
        { error: "No pending estimate found" },
        { status: 404 }
      );
    }

    if (estimate.status !== "sent") {
      return NextResponse.json(
        { error: "Estimate is not in a state that can be responded to" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      // Update estimate to accepted
      const { error: updateError } = await adminSupabase
        .from("estimates")
        .update({
          status: "accepted",
          accepted_at: now,
          denied_at: null,
          denial_reason: null,
        })
        .eq("id", estimate.id);

      if (updateError) {
        throw updateError;
      }

      // Update job payment state to approved
      await adminSupabase
        .from("jobs")
        .update({
          payment_state: "approved",
          payment_approved_at: now,
          updated_at: now,
        })
        .eq("id", job.id);

      return NextResponse.json({ success: true, status: "accepted" });
    } else {
      // Update estimate to denied
      const { error: updateError } = await adminSupabase
        .from("estimates")
        .update({
          status: "denied",
          denied_at: now,
          denial_reason: denialReason || null,
          accepted_at: null,
        })
        .eq("id", estimate.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ success: true, status: "denied" });
    }
  } catch (error) {
    console.error("Error responding to estimate:", error);
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 }
    );
  }
}
