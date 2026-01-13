import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    // Get estimate by token
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("public_token", token)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 }
      );
    }

    // Check if already denied or accepted
    if (estimate.status === "denied") {
      return NextResponse.json({ success: true, message: "Already denied" });
    }

    if (estimate.status === "accepted") {
      return NextResponse.json(
        { error: "Cannot deny an accepted estimate" },
        { status: 400 }
      );
    }

    // Get denial reason from request body (optional)
    const body = await request.json().catch(() => ({}));
    const denialReason = body.reason || null;

    // Update estimate to denied status
    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        status: "denied",
        denied_at: new Date().toISOString(),
        denial_reason: denialReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.id);

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error denying estimate:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to deny estimate" },
        { status: 500 }
      );
    }

    // If job exists, add denial note but DON'T archive
    // Leave job active so contractor can revise and resend estimate
    if (estimate.job_id) {
      // Fetch job to get current notes
      const { data: job } = await supabase
        .from("jobs")
        .select("notes")
        .eq("id", estimate.job_id)
        .single();

      const denialNote = `[Estimate Denied ${new Date().toLocaleDateString()}] ${denialReason || "No reason provided"}`;
      const updatedNotes = job?.notes
        ? `${job.notes}\n\n${denialNote}`
        : denialNote;

      await supabase
        .from("jobs")
        .update({
          // Keep job in current status - don't archive
          // Contractor can revise estimate and resend
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", estimate.job_id);
    }

    return NextResponse.json({
      success: true,
      denied_at: new Date().toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error denying estimate:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
