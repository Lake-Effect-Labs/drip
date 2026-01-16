import { NextResponse } from "next/server";
import { createAdminClient } from "@drip/core/database/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.payment_method || "manual";

    // Get job by payment_token
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("payment_token", token)
      .single();

    if (jobError || !job) {
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
