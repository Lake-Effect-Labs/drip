import { describe, it, expect, vi } from "vitest";
import { calculateTotalGallons, groupMaterialsByProduct } from "../estimate-materials";

// We test the pure functions directly. The async functions that use createAdminClient
// are tested via API route tests with mocked Supabase.

describe("calculateTotalGallons", () => {
  it("sums quantity_gallons from materials", () => {
    const materials = [
      { quantity_gallons: 2 },
      { quantity_gallons: 3.5 },
      { quantity_gallons: 1 },
    ] as any[];
    expect(calculateTotalGallons(materials)).toBe(6.5);
  });

  it("handles null quantity_gallons", () => {
    const materials = [
      { quantity_gallons: 2 },
      { quantity_gallons: null },
      { quantity_gallons: 3 },
    ] as any[];
    expect(calculateTotalGallons(materials)).toBe(5);
  });

  it("returns 0 for empty array", () => {
    expect(calculateTotalGallons([])).toBe(0);
  });

  it("returns 0 when all quantities are null", () => {
    const materials = [
      { quantity_gallons: null },
      { quantity_gallons: null },
    ] as any[];
    expect(calculateTotalGallons(materials)).toBe(0);
  });

  it("handles single material", () => {
    const materials = [{ quantity_gallons: 5 }] as any[];
    expect(calculateTotalGallons(materials)).toBe(5);
  });

  it("handles decimal quantities", () => {
    const materials = [
      { quantity_gallons: 0.5 },
      { quantity_gallons: 0.25 },
    ] as any[];
    expect(calculateTotalGallons(materials)).toBe(0.75);
  });
});

describe("groupMaterialsByProduct", () => {
  it("groups materials by paint_product", () => {
    const materials = [
      { paint_product: "Sherwin Williams Duration", quantity_gallons: 2, line_total: 100 },
      { paint_product: "Sherwin Williams Duration", quantity_gallons: 1, line_total: 50 },
      { paint_product: "Sherwin Williams Emerald", quantity_gallons: 3, line_total: 200 },
    ] as any[];

    const result = groupMaterialsByProduct(materials);

    expect(result).toHaveLength(2);

    const duration = result.find((g) => g.product === "Sherwin Williams Duration");
    expect(duration).toBeDefined();
    expect(duration!.materials).toHaveLength(2);
    expect(duration!.totalGallons).toBe(3);
    expect(duration!.totalCost).toBe(150);

    const emerald = result.find((g) => g.product === "Sherwin Williams Emerald");
    expect(emerald).toBeDefined();
    expect(emerald!.materials).toHaveLength(1);
    expect(emerald!.totalGallons).toBe(3);
    expect(emerald!.totalCost).toBe(200);
  });

  it("uses 'Other Materials' for null paint_product", () => {
    const materials = [
      { paint_product: null, quantity_gallons: 1, line_total: 50 },
      { paint_product: null, quantity_gallons: 2, line_total: null },
    ] as any[];

    const result = groupMaterialsByProduct(materials);

    expect(result).toHaveLength(1);
    expect(result[0].product).toBe("Other Materials");
    expect(result[0].materials).toHaveLength(2);
    expect(result[0].totalGallons).toBe(3);
    expect(result[0].totalCost).toBe(50);
  });

  it("returns empty array for empty input", () => {
    const result = groupMaterialsByProduct([]);
    expect(result).toHaveLength(0);
  });

  it("handles materials with null line_total and quantity_gallons", () => {
    const materials = [
      { paint_product: "TestProduct", quantity_gallons: null, line_total: null },
    ] as any[];

    const result = groupMaterialsByProduct(materials);

    expect(result).toHaveLength(1);
    expect(result[0].totalGallons).toBe(0);
    expect(result[0].totalCost).toBe(0);
  });

  it("mixes null and non-null paint_products", () => {
    const materials = [
      { paint_product: "Duration", quantity_gallons: 2, line_total: 100 },
      { paint_product: null, quantity_gallons: 1, line_total: 25 },
    ] as any[];

    const result = groupMaterialsByProduct(materials);
    expect(result).toHaveLength(2);

    const products = result.map((g) => g.product).sort();
    expect(products).toEqual(["Duration", "Other Materials"]);
  });
});
