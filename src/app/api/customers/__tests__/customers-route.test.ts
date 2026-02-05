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
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

describe("GET /api/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost:3001/api/customers"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user has no company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost:3001/api/customers"));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("not associated with a company");
  });

  it("returns customers for the user's company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const mockCustomers = [
      { id: "cust-1", name: "Alice", company_id: "c1" },
      { id: "cust-2", name: "Bob", company_id: "c1" },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "customers") {
        const c: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
        };
        return c;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost:3001/api/customers"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe("Alice");
  });
});

describe("POST /api/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: "c1", name: "Test" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
  });

  it("returns 400 when missing required fields", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { POST } = await import("../route");

    // Missing name
    const response = await POST(
      new Request("http://localhost:3001/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: "c1" }),
      })
    );
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
      new Request("http://localhost:3001/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: "c1", name: "Test Customer" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(403);
  });

  it("successfully creates a customer", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const mockCustomer = {
      id: "cust-1",
      company_id: "c1",
      name: "New Customer",
      phone: "555-1234",
      email: "new@customer.com",
    };

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "customers") {
        return chain({ data: mockCustomer, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost:3001/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: "c1",
          name: "New Customer",
          phone: "555-1234",
          email: "new@customer.com",
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.name).toBe("New Customer");
    expect(json.id).toBe("cust-1");
  });
});
