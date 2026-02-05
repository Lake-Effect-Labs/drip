import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Clean up expired entries periodically
function cleanup(store: Map<string, RateLimitEntry>) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Simple in-memory rate limiter for API routes.
 * Returns null if the request is allowed, or a 429 Response if rate-limited.
 *
 * @param key - Unique identifier for the client (e.g., IP address or user ID)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param storeName - Namespace to separate different rate limit pools
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  storeName = "default"
): NextResponse | null {
  if (!stores.has(storeName)) {
    stores.set(storeName, new Map());
  }

  const store = stores.get(storeName)!;

  // Periodic cleanup every 100 checks
  if (Math.random() < 0.01) {
    cleanup(store);
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  entry.count++;
  return null;
}

/**
 * Extract client IP from a request, using forwarded headers if available.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}
