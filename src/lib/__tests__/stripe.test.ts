import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to reset the module between tests since stripe.ts uses a singleton
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStripe", () => {
  it("throws when STRIPE_SECRET_KEY is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { getStripe } = await import("../stripe");
    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
  });

  it("returns a Stripe instance when key is set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_key_123");
    const { getStripe } = await import("../stripe");
    const stripe = getStripe();
    expect(stripe).toBeDefined();
    expect(typeof stripe.customers).toBe("object");
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_key_123");
    const { getStripe } = await import("../stripe");
    const stripe1 = getStripe();
    const stripe2 = getStripe();
    expect(stripe1).toBe(stripe2);
  });
});

describe("getStripeOrNull", () => {
  it("returns null when STRIPE_SECRET_KEY is not set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { getStripeOrNull } = await import("../stripe");
    expect(getStripeOrNull()).toBeNull();
  });

  it("returns a Stripe instance when key is set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_key_456");
    const { getStripeOrNull } = await import("../stripe");
    const stripe = getStripeOrNull();
    expect(stripe).toBeDefined();
    expect(stripe).not.toBeNull();
  });
});
