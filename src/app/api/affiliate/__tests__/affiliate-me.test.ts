import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockAuthGetUser() },
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
  obj.neq = vi.fn().mockReturnValue(obj);
  obj.in = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makePostRequest(body: any = {}) {
  return new Request("http://localhost:3001/api/affiliate/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(body: any = {}) {
  return new Request("http://localhost:3001/api/affiliate/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/affiliate/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../me/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns isAffiliate: false when user is not an affiliate", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: false, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../me/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.isAffiliate).toBe(false);
  });

  it("returns affiliate info with creator code stats", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test User" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({
          data: {
            id: "cc-1",
            code: "TESTCODE",
            discount_percent: 10,
            commission_percent: 20,
            total_referrals: 5,
            total_conversions: 2,
            is_active: true,
            created_at: "2025-01-01",
            user_id: "user-1",
          },
          error: null,
        });
      }
      if (table === "referrals") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      converted_at: "2025-01-15",
                      created_at: "2025-01-10",
                      subscriber_company_id: "comp-1",
                      commission_owed: 5.8,
                    },
                    {
                      converted_at: null,
                      created_at: "2025-01-12",
                      subscriber_company_id: null,
                      commission_owed: 0,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "companies") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "comp-1" }],
                error: null,
              }),
            }),
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../me/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.isAffiliate).toBe(true);
    expect(json.creatorCode.code).toBe("TESTCODE");
    expect(json.creatorCode.totalReferrals).toBe(5);
    expect(json.creatorCode.totalConversions).toBe(2);
    expect(json.creatorCode.activeSubscriberCount).toBe(1);
    expect(json.creatorCode.pendingPayout).toBe(5.8);
  });

  it("returns null creatorCode when affiliate has no code yet", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../me/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.isAffiliate).toBe(true);
    expect(json.creatorCode).toBeNull();
  });
});

describe("POST /api/affiliate/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "TEST" }));

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not an affiliate", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: false, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "TEST" }));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("You are not an affiliate");
  });

  it("returns 400 when affiliate already has a code", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({ data: { id: "cc-1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "NEWCODE" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("You already have a creator code");
  });

  it("returns 400 when code is missing or not a string", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({}));

    expect(response.status).toBe(400);
  });

  it("returns 400 when code is too short", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "AB" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("3-20 alphanumeric");
  });

  it("returns 400 when code is already taken", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let callCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        callCount++;
        // First call: check existing code for user (none)
        if (callCount === 1) {
          return chain({ data: null, error: null });
        }
        // Second call: check if code is taken (yes)
        return chain({ data: { id: "cc-other" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "TAKEN" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("This code is already taken");
  });

  it("successfully creates a creator code", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let callCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test User" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        callCount++;
        // First call: check existing code for user (none)
        if (callCount === 1) {
          return chain({ data: null, error: null });
        }
        // Second call: check if code is taken (no)
        if (callCount === 2) {
          return chain({ data: null, error: null });
        }
        // Third call: insert
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "cc-new",
                  code: "PAINTPRO",
                  discount_percent: 10,
                  commission_percent: 20,
                  total_referrals: 0,
                  total_conversions: 0,
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    const response = await POST(makePostRequest({ code: "paintpro" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.creatorCode.code).toBe("PAINTPRO");
    expect(json.creatorCode.commissionPercent).toBe(20);
  });

  it("normalizes code to uppercase and strips special chars", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let insertedCode: string | null = null;
    let callCount = 0;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: true, email: "a@b.com", full_name: "Test" },
          error: null,
        });
      }
      if (table === "creator_codes") {
        callCount++;
        if (callCount <= 2) {
          return chain({ data: null, error: null });
        }
        return {
          insert: vi.fn().mockImplementation((data: any) => {
            insertedCode = data.code;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "cc-new",
                    code: data.code,
                    discount_percent: 10,
                    commission_percent: 20,
                    total_referrals: 0,
                    total_conversions: 0,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../me/route");
    await POST(makePostRequest({ code: "paint-pro_123!" }));

    expect(insertedCode).toBe("PAINTPRO123");
  });
});

describe("PUT /api/affiliate/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { PUT } = await import("../me/route");
    const response = await PUT(makePutRequest({ code: "NEWCODE" }));

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not an affiliate", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({
          data: { is_affiliate: false },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../me/route");
    const response = await PUT(makePutRequest({ code: "NEWCODE" }));

    expect(response.status).toBe(403);
  });

  it("returns 400 when affiliate has no existing code", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_affiliate: true }, error: null });
      }
      if (table === "creator_codes") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../me/route");
    const response = await PUT(makePutRequest({ code: "NEWCODE" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("don't have a creator code");
  });

  it("returns 400 when new code is already taken by someone else", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let callCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_affiliate: true }, error: null });
      }
      if (table === "creator_codes") {
        callCount++;
        // First call: get existing code (has one)
        if (callCount === 1) {
          return chain({ data: { id: "cc-mine" }, error: null });
        }
        // Second call: check if new code taken (yes, by someone else)
        return chain({ data: { id: "cc-other" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../me/route");
    const response = await PUT(makePutRequest({ code: "TAKEN" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("This code is already taken");
  });

  it("successfully updates the creator code", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let callCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return chain({ data: { is_affiliate: true }, error: null });
      }
      if (table === "creator_codes") {
        callCount++;
        // First call: get existing code
        if (callCount === 1) {
          return chain({ data: { id: "cc-mine" }, error: null });
        }
        // Second call: check if new code taken (no)
        if (callCount === 2) {
          return chain({ data: null, error: null });
        }
        // Third call: update
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "cc-mine",
                    code: "NEWCODE",
                    discount_percent: 10,
                    commission_percent: 20,
                    total_referrals: 5,
                    total_conversions: 2,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../me/route");
    const response = await PUT(makePutRequest({ code: "newcode" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.creatorCode.code).toBe("NEWCODE");
  });
});
