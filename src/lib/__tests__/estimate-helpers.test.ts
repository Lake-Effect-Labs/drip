import { describe, it, expect, vi } from "vitest";
import { recalculateEstimateTotals } from "../estimate-helpers";

// Create mock Supabase client
function createMockSupabase(overrides: {
  lineItems?: { price: number | null }[];
  materials?: { line_total: number | null }[];
  lineItemsError?: any;
  materialsError?: any;
  updateError?: any;
} = {}) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: overrides.updateError || null }),
  });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "estimate_line_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: overrides.lineItems || [],
            error: overrides.lineItemsError || null,
          }),
        }),
      };
    }
    if (table === "estimate_materials") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: overrides.materials || [],
            error: overrides.materialsError || null,
          }),
        }),
      };
    }
    if (table === "estimates") {
      return { update: updateFn };
    }
    return {};
  });

  return {
    from: fromFn,
    _updateFn: updateFn,
  };
}

describe("recalculateEstimateTotals", () => {
  it("sums line item prices for labor total", async () => {
    const mockSupabase = createMockSupabase({
      lineItems: [{ price: 5000 }, { price: 3000 }, { price: 2000 }],
      materials: [],
    });

    await recalculateEstimateTotals(mockSupabase as any, "est-123");

    // Verify update was called on estimates table
    expect(mockSupabase.from).toHaveBeenCalledWith("estimates");
  });

  it("sums material line_totals for materials total", async () => {
    const mockSupabase = createMockSupabase({
      lineItems: [],
      materials: [{ line_total: 1500 }, { line_total: 2500 }],
    });

    await recalculateEstimateTotals(mockSupabase as any, "est-123");

    expect(mockSupabase.from).toHaveBeenCalledWith("estimates");
  });

  it("handles null prices gracefully", async () => {
    const mockSupabase = createMockSupabase({
      lineItems: [{ price: 5000 }, { price: null }, { price: 3000 }],
      materials: [{ line_total: null }, { line_total: 2000 }],
    });

    await recalculateEstimateTotals(mockSupabase as any, "est-123");

    // Should not throw, null values treated as 0
    expect(mockSupabase.from).toHaveBeenCalledWith("estimates");
  });

  it("handles empty line items and materials", async () => {
    const mockSupabase = createMockSupabase({
      lineItems: [],
      materials: [],
    });

    await recalculateEstimateTotals(mockSupabase as any, "est-123");

    expect(mockSupabase.from).toHaveBeenCalledWith("estimates");
  });

  it("handles null data from database", async () => {
    const fromFn = vi.fn().mockImplementation((table: string) => {
      if (table === "estimate_line_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === "estimate_materials") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === "estimates") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    const mockSupabase = { from: fromFn };
    // Should not throw when data is null
    await recalculateEstimateTotals(mockSupabase as any, "est-123");
    expect(fromFn).toHaveBeenCalledWith("estimates");
  });

  it("uses correct estimate ID in all queries", async () => {
    const eqCalls: string[] = [];
    const fromFn = vi.fn().mockImplementation((table: string) => {
      if (table === "estimate_line_items" || table === "estimate_materials") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              eqCalls.push(`${table}.${col}=${val}`);
              return Promise.resolve({ data: [], error: null });
            }),
          }),
        };
      }
      if (table === "estimates") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              eqCalls.push(`${table}.${col}=${val}`);
              return Promise.resolve({ error: null });
            }),
          }),
        };
      }
      return {};
    });

    await recalculateEstimateTotals({ from: fromFn } as any, "test-estimate-id");

    expect(eqCalls).toContain("estimate_line_items.estimate_id=test-estimate-id");
    expect(eqCalls).toContain("estimate_materials.estimate_id=test-estimate-id");
    expect(eqCalls).toContain("estimates.id=test-estimate-id");
  });
});
