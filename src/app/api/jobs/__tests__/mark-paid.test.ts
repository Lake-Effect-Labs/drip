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
  obj.update = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeRequest(body: any) {
  return new Request("http://localhost:3001/api/jobs/job-1/mark-paid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/jobs/[id]/mark-paid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../[id]/mark-paid/route");
    const response = await POST(makeRequest({ paymentMethod: "cash" }), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when job does not exist", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "jobs") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../[id]/mark-paid/route");
    const response = await POST(makeRequest({ paymentMethod: "cash" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Job not found");
  });

  it("returns 403 when user is not a company member", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "jobs") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../[id]/mark-paid/route");
    const response = await POST(makeRequest({ paymentMethod: "cash" }), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("successfully marks job as paid", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    let updateCalled = false;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "jobs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { company_id: "c1" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation(() => {
            updateCalled = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../[id]/mark-paid/route");
    const response = await POST(makeRequest({ paymentMethod: "check" }), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.paidAt).toBeDefined();
    expect(updateCalled).toBe(true);
  });
});
