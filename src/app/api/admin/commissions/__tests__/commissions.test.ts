import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
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
  obj.not = vi.fn().mockReturnValue(obj);
  obj.in = vi.fn().mockReturnValue(obj);
  obj.is = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makePostRequest(body: any) {
  return new Request("http://localhost/api/admin/commissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/commissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../../commissions/route");
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 403 when not a super admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../commissions/route");
    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns empty affiliates when no referrals exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_super_admin: true }, error: null });
      }
      if (table === "referrals") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.not = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../commissions/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.affiliates).toHaveLength(0);
    expect(json.totals.unpaid).toBe(0);
  });
});

describe("POST /api/admin/commissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../../commissions/route");
    const res = await POST(makePostRequest({ referralIds: ["r1"] }));

    expect(res.status).toBe(401);
  });

  it("returns 403 when not a super admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_super_admin: false }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../../commissions/route");
    const res = await POST(makePostRequest({ referralIds: ["r1"] }));

    expect(res.status).toBe(403);
  });

  it("returns 400 when referralIds is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_super_admin: true }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../../commissions/route");
    const res = await POST(makePostRequest({}));

    expect(res.status).toBe(400);
  });

  it("marks referrals as paid successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    const updateChain = chain({ error: null });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_super_admin: true }, error: null });
      }
      if (table === "referrals") {
        return updateChain;
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../../commissions/route");
    const res = await POST(makePostRequest({ referralIds: ["r1", "r2"] }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.markedPaid).toBe(2);
  });
});
