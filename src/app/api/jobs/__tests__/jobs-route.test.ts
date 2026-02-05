import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock the Supabase server module
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

vi.mock("@/lib/utils", () => ({
  generateToken: vi.fn(() => "mock-token-abc123"),
}));

// Helper to create chainable mock
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
  return new Request("http://localhost:3001/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../route");
    const response = await POST(makeRequest({ company_id: "c1", title: "Test" }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when missing required fields", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { POST } = await import("../route");

    // Missing title
    const response = await POST(makeRequest({ company_id: "c1" }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("Missing required fields");
  });

  it("returns 400 when missing company_id", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { POST } = await import("../route");
    const response = await POST(makeRequest({ title: "Paint Job" }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("Missing required fields");
  });

  it("returns 403 when user is not a member of the company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      makeRequest({ company_id: "c1", title: "Paint Job" })
    );
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toContain("not a member");
  });

  it("returns 402 when trial user has reached job limit", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const callTracker: Record<string, number> = {};

    mockAdminFrom.mockImplementation((table: string) => {
      callTracker[table] = (callTracker[table] || 0) + 1;

      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: { subscription_status: "trialing" },
          error: null,
        });
      }
      if (table === "jobs") {
        // Simulate existing job count >= 1
        const c = chain({ data: null, error: null, count: 1 });
        c.select = vi.fn().mockReturnValue(c);
        return c;
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      makeRequest({ company_id: "c1", title: "Another Job" })
    );
    const json = await response.json();
    expect(response.status).toBe(402);
    expect(json.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("successfully creates a job for subscribed user", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const mockJob = {
      id: "job-1",
      company_id: "c1",
      title: "Paint Living Room",
      customer_id: null,
      status: "new",
      unified_job_token: "mock-token-abc123",
    };

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: { subscription_status: "active" },
          error: null,
        });
      }
      if (table === "jobs") {
        return chain({ data: mockJob, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      makeRequest({ company_id: "c1", title: "Paint Living Room" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.title).toBe("Paint Living Room");
    expect(json.id).toBe("job-1");
  });
});
