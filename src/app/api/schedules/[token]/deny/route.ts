import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    // Try to find job by multiple token types
    // 1. First try unified_job_token (new system)
    let job = null;

    const { data: jobByUnified } = await supabase
      .from("jobs")
      .select("*")
      .eq("unified_job_token", token)
      .maybeSingle();

    if (jobByUnified) {
      job = jobByUnified;
    } else {
      // 2. Try schedule_token
      const { data: jobBySchedule } = await supabase
        .from("jobs")
        .select("*")
        .eq("schedule_token", token)
        .maybeSingle();

      if (jobBySchedule) {
        job = jobBySchedule;
      } else {
        // 3. Try to find by estimate public_token
        const { data: estimate } = await supabase
          .from("estimates")
          .select("job_id")
          .eq("public_token", token)
          .maybeSingle();

        if (estimate?.job_id) {
          const { data: jobByEstimate } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", estimate.job_id)
            .single();

          job = jobByEstimate;
        }
      }
    }

    if (!job) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Check if already denied (idempotent)
    if (job.schedule_state === "denied") {
      return NextResponse.json({ success: true, message: "Already denied" });
    }

    // Get denial reason from request body (optional)
    let denialReason = null;
    try {
      const body = await request.json();
      denialReason = body.reason || null;
    } catch {
      // Request body is optional, continue without reason
    }

    // Build update object - only include denial_reason if migration has been run
    // (column might not exist if migration hasn't been applied yet)
    const updateData: any = {
      schedule_state: "denied",
      schedule_denied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try to include denial reason, but don't fail if column doesn't exist
    if (denialReason !== null) {
      updateData.schedule_denial_reason = denialReason;

      // Also append to notes
      const currentNotes = job.notes || "";
      const denialNote = `\n\nSchedule declined by customer (${new Date().toLocaleDateString()}): ${denialReason}`;
      updateData.notes = currentNotes + denialNote;
    }

    // Update job schedule state to denied
    const { error: updateError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", job.id);

    if (updateError) {
      // If error is about missing column, try without denial_reason
      if (updateError.message?.includes("schedule_denial_reason") || updateError.code === "42703") {
        const { error: retryError } = await supabase
          .from("jobs")
          .update({
            schedule_state: "denied",
            schedule_denied_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        if (retryError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error updating schedule:", retryError);
          }
          return NextResponse.json(
            { error: `Failed to deny schedule: ${retryError.message}` },
            { status: 500 }
          );
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.error("Error updating schedule:", updateError);
        }
        return NextResponse.json(
          { error: `Failed to deny schedule: ${updateError.message || "Unknown error"}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error denying schedule:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
