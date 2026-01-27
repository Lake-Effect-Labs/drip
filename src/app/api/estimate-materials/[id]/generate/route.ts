import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { regenerateEstimateMaterials, syncEstimateMaterialsToJob } from "@/lib/estimate-materials";

/**
 * POST /api/estimate-materials/[id]/generate
 * Regenerates materials for an estimate based on its line items
 * Also syncs the materials to the job's materials checklist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: estimateId } = await params;

    // Verify user has access to this estimate and get job_id
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, company_id, status, job_id")
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: "Estimate not found" },
        { status: 404 }
      );
    }

    // Regenerate materials (allowed for any status - painter can update their records anytime)
    const materials = await regenerateEstimateMaterials(estimateId);

    // Sync estimate materials to job materials checklist
    if (estimate.job_id) {
      try {
        await syncEstimateMaterialsToJob(estimateId, estimate.job_id);
      } catch (syncError) {
        console.error("Error syncing materials to job:", syncError);
        // Don't fail the request if sync fails - estimate materials were still generated
      }
    }

    return NextResponse.json({
      success: true,
      materials,
      count: materials.length,
    });
  } catch (error) {
    console.error("Error generating estimate materials:", error);
    return NextResponse.json(
      { error: "Failed to generate materials" },
      { status: 500 }
    );
  }
}
