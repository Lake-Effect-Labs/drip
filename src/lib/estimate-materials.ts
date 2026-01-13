import { createClient } from "@/lib/supabase/server";
import { EstimateLineItem, EstimateMaterial, InsertTables } from "@/types/database";

// Default cost per gallon if not found in inventory
const DEFAULT_COST_PER_GALLON = 45.0;

/**
 * Auto-generates estimate materials from line items
 * Creates paint materials based on paint details in line items
 */
export async function generateEstimateMaterials(estimateId: string): Promise<EstimateMaterial[]> {
  const supabase = await createClient();

  // Get all line items for this estimate
  const { data: lineItems, error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimateId);

  if (lineItemsError) {
    throw new Error(`Failed to fetch line items: ${lineItemsError.message}`);
  }

  if (!lineItems || lineItems.length === 0) {
    return [];
  }

  // Generate materials from line items with paint details
  const materialsToInsert: InsertTables<"estimate_materials">[] = [];

  for (const item of lineItems) {
    // Only create materials for items with paint details
    if (item.gallons_estimate && item.gallons_estimate > 0) {
      // Parse color code from paint_color_name_or_code (e.g., "SW 7029" or "Agreeable Gray")
      const colorCode = item.paint_color_name_or_code?.match(/[A-Z]{1,3}\s*\d+/i)?.[0] || null;
      const colorName = colorCode
        ? item.paint_color_name_or_code?.replace(colorCode, "").trim() || null
        : item.paint_color_name_or_code;

      // No cost calculation - materials are for informational purposes only
      const costPerGallon = null;
      const lineTotal = null;

      // Create descriptive material name
      const paintProduct = item.product_line
        ? `${item.product_line}${item.sheen ? ` ${item.sheen}` : ''}`
        : 'Paint';

      const materialName = `${paintProduct} - ${item.name}`;

      materialsToInsert.push({
        estimate_id: estimateId,
        estimate_line_item_id: item.id,
        name: materialName,
        paint_product: item.product_line || null,
        product_line: item.product_line,
        color_name: colorName,
        color_code: colorCode,
        sheen: item.sheen,
        area_description: item.name, // e.g., "Interior Walls", "Living Room"
        quantity_gallons: item.gallons_estimate,
        cost_per_gallon: costPerGallon,
        line_total: lineTotal,
        vendor_sku: item.vendor_sku,
        is_auto_generated: true,
      });
    }
  }

  if (materialsToInsert.length === 0) {
    return [];
  }

  // Insert materials
  const { data: insertedMaterials, error: insertError } = await supabase
    .from("estimate_materials")
    .insert(materialsToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to insert materials: ${insertError.message}`);
  }

  return insertedMaterials || [];
}

/**
 * Regenerates estimate materials by deleting auto-generated ones and creating new ones
 */
export async function regenerateEstimateMaterials(estimateId: string): Promise<EstimateMaterial[]> {
  const supabase = await createClient();

  // Delete all auto-generated materials for this estimate
  const { error: deleteError } = await supabase
    .from("estimate_materials")
    .delete()
    .eq("estimate_id", estimateId)
    .eq("is_auto_generated", true);

  if (deleteError) {
    throw new Error(`Failed to delete auto-generated materials: ${deleteError.message}`);
  }

  // Generate new materials
  return generateEstimateMaterials(estimateId);
}

/**
 * Gets materials breakdown for an estimate
 */
export async function getEstimateMaterialsBreakdown(estimateId: string) {
  const supabase = await createClient();

  const { data: materials, error } = await supabase
    .from("estimate_materials")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch materials: ${error.message}`);
  }

  const materialsTotal = materials?.reduce((sum, m) => sum + (m.line_total || 0), 0) || 0;

  return {
    materials: materials || [],
    materialsTotal, // in cents
  };
}

/**
 * Calculates the total gallons needed for an estimate
 */
export function calculateTotalGallons(materials: EstimateMaterial[]): number {
  return materials.reduce((sum, m) => sum + (m.quantity_gallons || 0), 0);
}

/**
 * Groups materials by paint product for better display
 */
export function groupMaterialsByProduct(materials: EstimateMaterial[]) {
  const grouped = new Map<string, EstimateMaterial[]>();

  for (const material of materials) {
    const key = material.paint_product || "Other Materials";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(material);
  }

  return Array.from(grouped.entries()).map(([product, items]) => ({
    product,
    materials: items,
    totalGallons: calculateTotalGallons(items),
    totalCost: items.reduce((sum, m) => sum + (m.line_total || 0), 0),
  }));
}
