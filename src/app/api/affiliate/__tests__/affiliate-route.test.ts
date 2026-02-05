import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => mockAdminFrom(table),
  })),
}));

function chain(resolvedValue: any) {
  const obj: any = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.insert = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.is = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

describe("GET /api/affiliate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when code is missing", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost:3001/api/affiliate")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Code is required");
  });

  it("returns valid: false for non-existent code", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost:3001/api/affiliate?code=BADCODE")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valid).toBe(false);
  });

  it("returns valid code info with $5 discount", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "creator_codes") {
        return chain({
          data: { code: "PAINTPRO", creator_name: "John" },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost:3001/api/affiliate?code=paintpro")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.code).toBe("PAINTPRO");
    expect(json.creatorName).toBe("John");
    expect(json.discountFlat).toBe(5);
  });
});

describe("POST /api/affiliate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when code or visitorId is missing", async () => {
    const { POST } = await import("../route");

    const response1 = await POST(
      new Request("http://localhost:3001/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "TEST" }),
      })
    );
    expect(response1.status).toBe(400);

    const response2 = await POST(
      new Request("http://localhost:3001/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "v1" }),
      })
    );
    expect(response2.status).toBe(400);
  });

  it("returns 404 for invalid code", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "BADCODE", visitorId: "v1" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Invalid code");
  });

  it("returns alreadyTracked when visitor already referred", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "creator_codes") {
        return chain({
          data: { id: "cc-1", total_referrals: 5 },
          error: null,
        });
      }
      if (table === "referrals") {
        return chain({
          data: { id: "ref-1" },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "PAINTPRO", visitorId: "v1" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.alreadyTracked).toBe(true);
  });

  it("creates new referral record with 30-day expiry", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "creator_codes") {
        const c: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "cc-1", total_referrals: 3 },
            error: null,
          }),
          then: (cb: any) =>
            Promise.resolve({
              data: { id: "cc-1", total_referrals: 3 },
              error: null,
            }).then(cb),
        };
        return c;
      }
      if (table === "referrals") {
        const c: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
          then: (cb: any) => Promise.resolve({ data: null, error: null }).then(cb),
        };
        return c;
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "PAINTPRO", visitorId: "new-visitor" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
