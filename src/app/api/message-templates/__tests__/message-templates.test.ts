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
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

describe("GET /api/message-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../../message-templates/route");
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 404 when user has no company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: { message: "not found" } });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../message-templates/route");
    const res = await GET();

    expect(res.status).toBe(404);
  });

  it("returns templates for the company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const mockTemplates = [
      { id: "t1", name: "Job Scheduled", body: "Hey {{customer_name}}", variables: ["customer_name"] },
      { id: "t2", name: "Thank You", body: "Thanks {{customer_name}}", variables: ["customer_name"] },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "message_templates") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: mockTemplates, error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../message-templates/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe("Job Scheduled");
  });
});

describe("PUT /api/message-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { PUT } = await import("../../message-templates/route");
    const res = await PUT(
      new Request("http://localhost/api/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "t1", body: "Updated" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when template ID is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../../message-templates/route");
    const res = await PUT(
      new Request("http://localhost/api/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Updated" }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when template belongs to another company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "message_templates") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { PUT } = await import("../../message-templates/route");
    const res = await PUT(
      new Request("http://localhost/api/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "t1", body: "Hacked!" }),
      })
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/message-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../../message-templates/route");
    const res = await POST(
      new Request("http://localhost/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", body: "Hello" }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when name or body is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../../message-templates/route");
    const res = await POST(
      new Request("http://localhost/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("creates template with extracted variables", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const insertChain = chain({
      data: {
        id: "t-new",
        name: "Custom",
        body: "Hi {{customer_name}}, your job at {{job_address}} is confirmed.",
        variables: ["customer_name", "job_address"],
      },
      error: null,
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "message_templates") {
        return insertChain;
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../../message-templates/route");
    const res = await POST(
      new Request("http://localhost/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Custom",
          body: "Hi {{customer_name}}, your job at {{job_address}} is confirmed.",
        }),
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe("Custom");
  });
});
