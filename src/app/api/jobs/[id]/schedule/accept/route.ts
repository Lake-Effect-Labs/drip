import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    // Get job by ID
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if already scheduled (idempotent)
    if (job.status === "scheduled") {
      return NextResponse.json({ success: true, message: "Already scheduled" });
    }

    // Update job status to scheduled
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error updating job:", updateError);
      }
      return NextResponse.json(
        { error: "Failed to confirm schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error confirming schedule:", error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
