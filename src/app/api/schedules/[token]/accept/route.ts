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

    // Check if already accepted (idempotent)
    if (job.schedule_state === "accepted") {
      return NextResponse.json({ success: true, message: "Already accepted" });
    }

    // Update job schedule state to accepted and status to scheduled
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        schedule_state: "accepted",
        schedule_accepted_at: new Date().toISOString(),
        status: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating schedule:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to accept schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error accepting schedule:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
