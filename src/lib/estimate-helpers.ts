import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recalculates labor_total and materials_total on an estimate
 * by summing estimate_line_items and estimate_materials.
 * Replaces the old recalculate_estimate_totals() SQL trigger.
 */
export async function recalculateEstimateTotals(
  supabase: SupabaseClient,
  estimateId: string
): Promise<void> {
  // Fetch labor total from line items
  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("price")
    .eq("estimate_id", estimateId);

  const laborTotal = (lineItems || []).reduce(
    (sum, item) => sum + (item.price || 0),
    0
  );

  // Fetch materials total
  const { data: materials } = await supabase
    .from("estimate_materials")
    .select("line_total")
    .eq("estimate_id", estimateId);

  const materialsTotal = (materials || []).reduce(
    (sum, item) => sum + (item.line_total || 0),
    0
  );

  // Update the estimate
  await supabase
    .from("estimates")
    .update({
      labor_total: laborTotal,
      materials_total: materialsTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);
}
