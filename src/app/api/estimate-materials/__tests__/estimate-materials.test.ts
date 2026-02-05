import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}));

vi.mock("@/lib/estimate-helpers", () => ({
  recalculateEstimateTotals: vi.fn().mockResolvedValue(undefined),
}));

function chain(resolvedValue: any) {
  const obj: any = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeGetRequest(estimateId: string) {
  return new Request(
    `http://localhost:3001/api/estimate-materials/${estimateId}`,
    { method: "GET" }
  ) as any;
}

const makeParams = (id: string) => Promise.resolve({ id });

describe("GET /api/estimate-materials/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../../estimate-materials/[id]/route");
    const res = await GET(makeGetRequest("est-1"), { params: makeParams("est-1") });

    expect(res.status).toBe(401);
  });

  it("returns 404 when user has no company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: { message: "not found" } });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../estimate-materials/[id]/route");
    const res = await GET(makeGetRequest("est-1"), { params: makeParams("est-1") });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("No company found");
  });

  it("returns 404 when estimate belongs to a different company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "estimates") {
        // Estimate not found because company_id filter rejects it
        return chain({ data: null, error: { message: "not found" } });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../estimate-materials/[id]/route");
    const res = await GET(makeGetRequest("est-from-company-B"), {
      params: makeParams("est-from-company-B"),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Estimate not found");
  });

  it("verifies company_id filter is applied to estimate query", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const estimateChain = chain({
      data: { id: "est-1", company_id: "company-A" },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "estimates") {
        return estimateChain;
      }
      if (table === "estimate_materials") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../estimate-materials/[id]/route");
    await GET(makeGetRequest("est-1"), { params: makeParams("est-1") });

    // Verify eq was called with company_id filter
    expect(estimateChain.eq).toHaveBeenCalledWith("id", "est-1");
    expect(estimateChain.eq).toHaveBeenCalledWith("company_id", "company-A");
  });

  it("returns materials with totals when authorized", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const mockMaterials = [
      { id: "m1", name: "Primer", quantity_gallons: 2, line_total: 6000 },
      { id: "m2", name: "Paint", quantity_gallons: 3, line_total: 12000 },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "estimates") {
        return chain({
          data: { id: "est-1", company_id: "company-A" },
          error: null,
        });
      }
      if (table === "estimate_materials") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: mockMaterials, error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../estimate-materials/[id]/route");
    const res = await GET(makeGetRequest("est-1"), { params: makeParams("est-1") });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.materials).toHaveLength(2);
    expect(json.materialsTotal).toBe(18000);
    expect(json.totalGallons).toBe(5);
  });
});
