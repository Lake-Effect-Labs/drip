import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!companyUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get job and verify it belongs to user's company
    const { data: job, error: jobError } = await adminSupabase
      .from("jobs")
      .select("company_id")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.company_id !== companyUser.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { progress_percentage } = body;

    // Validate progress percentage
    if (typeof progress_percentage !== "number" || progress_percentage < 0 || progress_percentage > 100) {
      return NextResponse.json(
        { error: "Progress percentage must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Update job progress
    const { error: updateError } = await adminSupabase
      .from("jobs")
      .update({
        progress_percentage: Math.round(progress_percentage),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating job progress:", updateError);
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      progress_percentage: Math.round(progress_percentage),
    });
  } catch (error) {
    console.error("Error in progress update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
