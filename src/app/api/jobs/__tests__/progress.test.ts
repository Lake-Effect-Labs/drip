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
  return new Request("http://localhost:3001/api/jobs/job-1/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/jobs/[id]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: 50 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid progress percentage (negative)", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "jobs") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: -10 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("between 0 and 100");
  });

  it("returns 400 for progress percentage over 100", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "jobs") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: 150 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("between 0 and 100");
  });

  it("returns 400 for non-number progress percentage", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "jobs") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: "fifty" }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
  });

  it("returns 403 when job belongs to different company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "jobs") {
        return chain({ data: { company_id: "c2" }, error: null }); // Different company
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: 50 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
  });

  it("successfully updates progress", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: 75 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.progress_percentage).toBe(75);
  });

  it("rounds decimal progress to integer", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../[id]/progress/route");
    const response = await PUT(makeRequest({ progress_percentage: 33.7 }) as any, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.progress_percentage).toBe(34);
  });
});
