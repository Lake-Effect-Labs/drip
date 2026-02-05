import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAuthGetUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockStripeCustomersCreate = vi.fn();
const mockStripeCouponsCreate = vi.fn();
const mockStripeCouponsRetrieve = vi.fn();
const mockStripeCheckoutSessionsCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockAuthGetUser() },
  }),
  createAdminClient: vi.fn(() => ({
    from: (table: string) => mockAdminFrom(table),
  })),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    customers: { create: mockStripeCustomersCreate },
    coupons: { create: mockStripeCouponsCreate, retrieve: mockStripeCouponsRetrieve },
    checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
  })),
}));

function chain(resolvedValue: any) {
  const obj: any = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeRequest(body: any = {}) {
  return new Request("http://localhost:3001/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3001",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_PRICE_ID", "price_test123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when STRIPE_PRICE_ID is not configured", async () => {
    vi.stubEnv("STRIPE_PRICE_ID", "");

    const { POST } = await import("../checkout/route");
    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toContain("not configured");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("../checkout/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when user has no company", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../checkout/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(404);
  });

  it("returns 400 when company already has active subscription", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: { id: "c1", subscription_status: "active" },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const { POST } = await import("../checkout/route");
    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Already subscribed");
  });

  it("creates Stripe checkout session successfully", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: {
            id: "c1",
            subscription_status: "trialing",
            stripe_customer_id: "cus_test123",
          },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session/test",
    });

    const { POST } = await import("../checkout/route");
    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/session/test");
  });

  it("creates new Stripe customer when none exists", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: {
            id: "c1",
            subscription_status: "trialing",
            stripe_customer_id: null,
          },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new123" });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session/test",
    });

    const { POST } = await import("../checkout/route");
    await POST(makeRequest());

    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: "a@b.com",
      metadata: { company_id: "c1", user_id: "user-1" },
    });
  });

  it("applies referral discount when valid referral code provided", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "c1" }, error: null });
      }
      if (table === "companies") {
        return chain({
          data: {
            id: "c1",
            subscription_status: "trialing",
            stripe_customer_id: "cus_test123",
          },
          error: null,
        });
      }
      if (table === "creator_codes") {
        return chain({
          data: { id: "cc-1", code: "PAINTPRO", is_active: true },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    // Simulate coupon not existing yet — retrieve throws, create succeeds
    mockStripeCouponsRetrieve.mockRejectedValue(new Error("No such coupon"));
    mockStripeCouponsCreate.mockResolvedValue({ id: "matte_referral_5off" });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session/test",
    });

    const { POST } = await import("../checkout/route");
    await POST(
      makeRequest({ referralCode: "PAINTPRO", visitorId: "v1" })
    );

    expect(mockStripeCouponsRetrieve).toHaveBeenCalledWith("matte_referral_5off");
    expect(mockStripeCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "matte_referral_5off",
        amount_off: 500,
        currency: "usd",
        duration: "once",
      })
    );
  });
});
