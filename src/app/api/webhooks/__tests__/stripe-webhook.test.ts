import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAdminFrom = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => mockAdminFrom(table),
  })),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeOrNull: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation((name: string) => {
      if (name === "stripe-signature") return "sig_test_123";
      return null;
    }),
  }),
}));

function chain(resolvedValue: any) {
  const obj: any = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.is = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeRequest(body: string = "{}") {
  return new Request("http://localhost:3001/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_test_123",
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid signature");
  });

  it("handles checkout.session.completed for subscription", async () => {
    let companyUpdated = false;

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            company_id: "c1",
            user_id: "user-1",
            creator_code_id: "",
            visitor_id: "",
          },
          mode: "subscription",
          subscription: "sub_test123",
          payment_status: "paid",
        },
      },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "companies") {
        return {
          update: vi.fn().mockImplementation(() => {
            companyUpdated = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(companyUpdated).toBe(true);
  });

  it("handles checkout.session.completed for job payment", async () => {
    let jobUpdated = false;

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { job_id: "job-1" },
          mode: "payment",
          payment_status: "paid",
        },
      },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "jobs") {
        return {
          update: vi.fn().mockImplementation(() => {
            jobUpdated = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(jobUpdated).toBe(true);
  });

  it("handles customer.subscription.deleted", async () => {
    let updatePayload: any = null;

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          metadata: { company_id: "c1" },
        },
      },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "companies") {
        return {
          update: vi.fn().mockImplementation((data: any) => {
            updatePayload = data;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual({
      subscription_status: "canceled",
      subscription_id: null,
    });
  });

  it("handles invoice.payment_failed", async () => {
    let statusUpdated = false;

    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "inv_123",
          subscription: "sub_test456",
        },
      },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "companies") {
        return {
          update: vi.fn().mockImplementation(() => {
            statusUpdated = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(statusUpdated).toBe(true);
  });

  it("handles checkout with affiliate conversion", async () => {
    let referralUpdated = false;
    let conversionsIncremented = false;

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            company_id: "c1",
            user_id: "user-1",
            creator_code_id: "cc-1",
            visitor_id: "v-1",
          },
          mode: "subscription",
          subscription: "sub_test789",
          payment_status: "paid",
        },
      },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "companies") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "creator_codes") {
        const c: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation(() => {
            conversionsIncremented = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          single: vi.fn().mockResolvedValue({
            data: { commission_percent: 20, total_conversions: 5 },
            error: null,
          }),
        };
        return c;
      }
      if (table === "referrals") {
        return {
          update: vi.fn().mockImplementation(() => {
            referralUpdated = true;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            };
          }),
        };
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(referralUpdated).toBe(true);
    expect(conversionsIncremented).toBe(true);
  });

  it("returns received: true for unknown event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });

    const { POST } = await import("../stripe/route");
    const response = await POST(makeRequest("raw-body"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
  });
});
