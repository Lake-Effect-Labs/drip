import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  try {
    // Get job by schedule_token
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("schedule_token", token)
      .single();

    if (jobError || !job) {
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
