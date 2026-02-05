import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  }),
}));

function chain(resolvedValue: any) {
  const obj: any = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue(resolvedValue);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  obj.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return obj;
}

function makeRequest(jobId: string) {
  return new Request(`http://localhost:3001/api/jobs/${jobId}/photos`, {
    method: "GET",
  }) as any;
}

const makeParams = (id: string) => Promise.resolve({ id });

describe("GET /api/jobs/[id]/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const { GET } = await import("../../jobs/[id]/photos/route");
    const res = await GET(makeRequest("job-1"), { params: makeParams("job-1") });

    expect(res.status).toBe(401);
  });

  it("returns 404 when user has no company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: null, error: { message: "not found" } });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../jobs/[id]/photos/route");
    const res = await GET(makeRequest("job-1"), { params: makeParams("job-1") });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("No company found");
  });

  it("returns 404 when job belongs to a different company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "jobs") {
        // Job not found because company_id doesn't match
        return chain({ data: null, error: { message: "not found" } });
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../jobs/[id]/photos/route");
    const res = await GET(makeRequest("job-from-company-B"), {
      params: makeParams("job-from-company-B"),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Job not found");
  });

  it("returns photos when job belongs to user's company", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const mockPhotos = [
      { id: "photo-1", job_id: "job-1", public_url: "https://example.com/1.jpg" },
      { id: "photo-2", job_id: "job-1", public_url: "https://example.com/2.jpg" },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "jobs") {
        return chain({ data: { id: "job-1" }, error: null });
      }
      if (table === "job_photos") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: mockPhotos, error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../jobs/[id]/photos/route");
    const res = await GET(makeRequest("job-1"), { params: makeParams("job-1") });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe("photo-1");
  });

  it("verifies company_id filter is applied to job query", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const jobsChain = chain({ data: { id: "job-1" }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "company_users") {
        return chain({ data: { company_id: "company-A" }, error: null });
      }
      if (table === "jobs") {
        return jobsChain;
      }
      if (table === "job_photos") {
        const obj: any = {};
        obj.select = vi.fn().mockReturnValue(obj);
        obj.eq = vi.fn().mockReturnValue(obj);
        obj.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return obj;
      }
      return chain({ data: null, error: null });
    });

    const { GET } = await import("../../jobs/[id]/photos/route");
    await GET(makeRequest("job-1"), { params: makeParams("job-1") });

    // Verify eq was called twice: once for job_id, once for company_id
    expect(jobsChain.eq).toHaveBeenCalledWith("id", "job-1");
    expect(jobsChain.eq).toHaveBeenCalledWith("company_id", "company-A");
  });
});
