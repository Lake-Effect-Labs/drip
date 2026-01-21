import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.payment_method || "manual";

    // Try to find job by multiple token types
    // 1. First try payment_token
    let { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("payment_token", token)
      .single();

    // 2. If not found, try unified_job_token
    if (!job) {
      const { data: jobByUnified } = await supabase
        .from("jobs")
        .select("*")
        .eq("unified_job_token", token)
        .single();
      job = jobByUnified;
    }

    // 3. If still not found, try finding via estimate public_token
    if (!job) {
      const { data: estimate } = await supabase
        .from("estimates")
        .select("job_id")
        .eq("public_token", token)
        .single();

      if (estimate?.job_id) {
        const { data: jobByEstimate } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", estimate.job_id)
          .single();
        job = jobByEstimate;
      }
    }

    if (!job) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Check if already paid (idempotent)
    if (job.payment_state === "paid") {
      return NextResponse.json({ success: true, message: "Already paid" });
    }

    // Update job payment state to paid
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        payment_state: "paid",
        payment_paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
        status: "paid", // Also update job status to move card to paid column
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating payment:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to mark payment as paid" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error marking payment as paid:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
