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
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeRequest(body: any) {
  return new Request("http://localhost:3001/api/jobs/job-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { PATCH } = await import("../[id]/route");
    const response = await PATCH(makeRequest({ title: "Updated" }), {
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

    const { PATCH } = await import("../[id]/route");
    const response = await PATCH(makeRequest({ title: "Updated" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Job not found");
  });

  it("returns 403 when user is not a member of the company", async () => {
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

    const { PATCH } = await import("../[id]/route");
    const response = await PATCH(makeRequest({ title: "Updated" }), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("not a member");
  });

  it("only updates whitelisted fields", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    let updatePayload: any = null;
    const updateChain: any = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "job-1", title: "Updated", customer_id: null, company_id: "c1" },
          error: null,
        }),
      }),
      eq: vi.fn().mockReturnThis(),
    };

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
          update: vi.fn().mockImplementation((data: any) => {
            updatePayload = data;
            return updateChain;
          }),
        };
      }
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "customers") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PATCH } = await import("../[id]/route");
    const response = await PATCH(
      makeRequest({
        title: "Updated",
        company_id: "malicious-id", // Should be filtered out
        unified_job_token: "hacked", // Should be filtered out
        status: "quoted",
      }),
      { params: Promise.resolve({ id: "job-1" }) }
    );

    // The update payload should NOT contain company_id or unified_job_token
    expect(updatePayload).toBeDefined();
    expect(updatePayload.title).toBe("Updated");
    expect(updatePayload.status).toBe("quoted");
    expect(updatePayload.company_id).toBeUndefined();
    expect(updatePayload.unified_job_token).toBeUndefined();
  });
});
