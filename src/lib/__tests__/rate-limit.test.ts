import { describe, it, expect } from "vitest";
import { rateLimit, getClientIp } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const result = rateLimit("test-ip-1", 5, 60_000, "test-allow");
    expect(result).toBeNull();
  });

  it("returns 429 when limit is exceeded", () => {
    const storeName = "test-exceeded";
    // Use up the limit
    for (let i = 0; i < 3; i++) {
      rateLimit("test-ip-2", 3, 60_000, storeName);
    }
    // Next request should be rate-limited
    const result = rateLimit("test-ip-2", 3, 60_000, storeName);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("includes Retry-After header in 429 response", async () => {
    const storeName = "test-retry-after";
    for (let i = 0; i < 2; i++) {
      rateLimit("test-ip-3", 2, 60_000, storeName);
    }
    const result = rateLimit("test-ip-3", 2, 60_000, storeName);
    expect(result).not.toBeNull();
    expect(result!.headers.get("Retry-After")).toBeTruthy();
    const json = await result!.json();
    expect(json.error).toContain("Too many requests");
  });

  it("tracks separate keys independently", () => {
    const storeName = "test-separate-keys";
    // Use up limit for one key
    for (let i = 0; i < 3; i++) {
      rateLimit("ip-a", 3, 60_000, storeName);
    }
    // Different key should still be allowed
    const result = rateLimit("ip-b", 3, 60_000, storeName);
    expect(result).toBeNull();
  });

  it("tracks separate stores independently", () => {
    // Use up limit in one store
    for (let i = 0; i < 2; i++) {
      rateLimit("same-ip", 2, 60_000, "store-x");
    }
    // Same key in different store should be allowed
    const result = rateLimit("same-ip", 2, 60_000, "store-y");
    expect(result).toBeNull();
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("extracts IP from x-real-ip header", () => {
    const request = new Request("http://localhost/test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(request)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const request = new Request("http://localhost/test");
    expect(getClientIp(request)).toBe("unknown");
  });
});
