import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env module", () => {
  it("reads required Supabase environment variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-456");
    vi.stubEnv("NODE_ENV", "development");

    const { env } = await import("../env");

    expect(env.supabaseUrl).toBe("https://test.supabase.co");
    expect(env.supabaseAnonKey).toBe("anon-key-123");
    expect(env.supabaseServiceRoleKey).toBe("service-key-456");
  });

  it("allows optional variables to be empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-456");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("WEATHER_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");

    const { env } = await import("../env");

    expect(env.stripeSecretKey).toBe("");
    expect(env.weatherApiKey).toBe("");
  });

  it("returns default appUrl when not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-456");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    const { env } = await import("../env");

    expect(env.appUrl).toBe("http://localhost:3000");
  });

  it("sets isDevelopment flag correctly", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key-456");
    vi.stubEnv("NODE_ENV", "development");

    const { env } = await import("../env");

    expect(env.isDevelopment).toBe(true);
    expect(env.isProduction).toBe(false);
  });

  it("throws for missing required env vars", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NODE_ENV", "development");

    await expect(import("../env")).rejects.toThrow(
      "Missing required environment variable"
    );
  });
});
