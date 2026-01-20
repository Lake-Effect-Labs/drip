import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/estimate-materials/[id]/[materialId]
 * Updates a material for an estimate
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: estimateId, materialId } = await params;
    const body = await request.json();

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

    // Verify the material belongs to this estimate
    const { data: existingMaterial, error: materialError } = await supabase
      .from("estimate_materials")
      .select("*")
      .eq("id", materialId)
      .eq("estimate_id", estimateId)
      .single();

    if (materialError || !existingMaterial) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Calculate new line total if quantity or cost changed
    const quantityGallons = body.quantity_gallons ?? existingMaterial.quantity_gallons ?? 0;
    const costPerGallon = body.cost_per_gallon ?? existingMaterial.cost_per_gallon ?? 0;
    const lineTotal = Math.round(quantityGallons * costPerGallon * 100);

    // Update material
    const updateData: any = {
      ...body,
      line_total: lineTotal,
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.estimate_id;
    delete updateData.created_at;
    delete updateData.updated_at;

    const { data: material, error: updateError } = await supabase
      .from("estimate_materials")
      .update(updateData)
      .eq("id", materialId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ material });
  } catch (error) {
    console.error("Error updating estimate material:", error);
    return NextResponse.json(
      { error: "Failed to update material" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/estimate-materials/[id]/[materialId]
 * Deletes a material from an estimate
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: estimateId, materialId } = await params;

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

    // Delete the material
    const { error: deleteError } = await supabase
      .from("estimate_materials")
      .delete()
      .eq("id", materialId)
      .eq("estimate_id", estimateId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting estimate material:", error);
    return NextResponse.json(
      { error: "Failed to delete material" },
      { status: 500 }
    );
  }
}
