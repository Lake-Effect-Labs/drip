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
  obj.lt = vi.fn().mockReturnValue(obj);
  obj.like = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

describe("GET /api/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns empty reminders when user has no company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders).toEqual([]);
  });

  it("returns stale estimates as reminders", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "comp-1" }, error: null });
      }
      if (table === "estimates") {
        const c: any = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.lt = vi.fn().mockReturnValue(c);
        c.order = vi.fn().mockResolvedValue({
          data: [
            {
              id: "est-1",
              job_id: "job-1",
              sent_at: threeDaysAgo.toISOString(),
              status: "sent",
              created_at: threeDaysAgo.toISOString(),
              jobs: {
                id: "job-1",
                title: "Kitchen Repaint",
                customer_id: "cust-1",
                customers: {
                  name: "Jane Doe",
                  phone: "555-0123",
                  email: "jane@example.com",
                },
              },
            },
          ],
          error: null,
        });
        return c;
      }
      if (table === "nudge_dismissals") {
        const c: any = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.like = vi.fn().mockResolvedValue({ data: [], error: null });
        return c;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders).toHaveLength(1);
    expect(json.reminders[0].jobTitle).toBe("Kitchen Repaint");
    expect(json.reminders[0].customerName).toBe("Jane Doe");
    expect(json.reminders[0].daysAgo).toBeGreaterThanOrEqual(3);
  });

  it("excludes dismissed reminders", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "comp-1" }, error: null });
      }
      if (table === "estimates") {
        const c: any = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.lt = vi.fn().mockReturnValue(c);
        c.order = vi.fn().mockResolvedValue({
          data: [
            {
              id: "est-dismissed",
              job_id: "job-1",
              sent_at: fiveDaysAgo.toISOString(),
              status: "sent",
              created_at: fiveDaysAgo.toISOString(),
              jobs: {
                id: "job-1",
                title: "Dismissed Job",
                customer_id: "cust-1",
                customers: { name: "Bob", phone: null, email: null },
              },
            },
          ],
          error: null,
        });
        return c;
      }
      if (table === "nudge_dismissals") {
        const c: any = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.like = vi.fn().mockResolvedValue({
          data: [{ nudge_type: "followup_est-dismissed" }],
          error: null,
        });
        return c;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders).toHaveLength(0);
  });
});

describe("POST /api/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: "est-1" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when estimateId is missing", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
  });

  it("dismisses a reminder by inserting into nudge_dismissals", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    let insertedData: any = null;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "comp-1" }, error: null });
      }
      if (table === "nudge_dismissals") {
        return {
          insert: vi.fn().mockImplementation((data: any) => {
            insertedData = data;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: "est-123" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(insertedData).toEqual({
      user_id: "user-1",
      company_id: "comp-1",
      nudge_type: "followup_est-123",
    });
  });

  it("returns 404 when user has no company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: "est-1" }),
      })
    );

    expect(response.status).toBe(404);
  });
});
