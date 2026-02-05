import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase SSR module
const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Minimal mock for NextResponse and NextRequest
const mockRedirect = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn().mockImplementation(({ request }: { request: unknown }) => ({
      cookies: {
        set: vi.fn(),
      },
      request,
    })),
    redirect: vi.fn().mockImplementation((url: { pathname: string }) => {
      mockRedirect(url.pathname);
      return { type: "redirect", url: url.pathname };
    }),
  },
}));

function makeNextRequest(pathname: string) {
  const url = new URL(`http://localhost:3001${pathname}`);
  return {
    cookies: {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    },
    nextUrl: {
      pathname,
      clone: () => ({ ...url, pathname }),
    },
  };
}

describe("updateSession middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users from /app to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/app/board") as never);

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("allows unauthenticated users to access auth routes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/login") as never);

    // Should not redirect - returns the supabaseResponse
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows unauthenticated users on signup", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/signup") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated users to access /app routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/app/board") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated users to stay on signup", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/signup") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows authenticated users on login page", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/login") as never);

    // Per the code, login page allows authenticated users to stay
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows join routes even for authenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/join/abc123") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows unauthenticated users on non-app routes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated user from /app/settings", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import("../middleware");
    await updateSession(makeNextRequest("/app/settings") as never);

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
