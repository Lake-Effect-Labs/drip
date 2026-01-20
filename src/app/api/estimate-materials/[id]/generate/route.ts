import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { regenerateEstimateMaterials } from "@/lib/estimate-materials";

/**
 * POST /api/estimate-materials/[id]/generate
 * Regenerates materials for an estimate based on its line items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: estimateId } = await params;

    // Verify user has access to this estimate
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, company_id, status")
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
