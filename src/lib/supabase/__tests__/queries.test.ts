import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTeamMembers,
  getJobsWithCustomers,
  getScheduledJobs,
  getDashboardData,
} from "../queries";

// Helper to create a chainable mock Supabase client
function createMockClient(tableHandlers: Record<string, (chain: any) => any> = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const chainObj: any = {};
      chainObj.select = vi.fn().mockReturnValue(chainObj);
      chainObj.eq = vi.fn().mockReturnValue(chainObj);
      chainObj.neq = vi.fn().mockReturnValue(chainObj);
      chainObj.in = vi.fn().mockReturnValue(chainObj);
      chainObj.not = vi.fn().mockReturnValue(chainObj);
      chainObj.is = vi.fn().mockReturnValue(chainObj);
      chainObj.order = vi.fn().mockReturnValue(chainObj);
      chainObj.then = (cb: any) => Promise.resolve({ data: [], error: null }).then(cb);

      if (tableHandlers[table]) {
        return tableHandlers[table](chainObj);
      }
      return chainObj;
    }),
  } as any;
}

// ─── getTeamMembers ─────────────────────────────────────────────────────────────

describe("getTeamMembers", () => {
  it("returns empty array when no company users found", async () => {
    const supabase = createMockClient({
      company_users: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: null, error: null }).then(cb);
        return chain;
      },
    });

    const result = await getTeamMembers(supabase, "c1");
    expect(result).toEqual([]);
  });

  it("returns empty array when company_users is empty", async () => {
    const supabase = createMockClient({
      company_users: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getTeamMembers(supabase, "c1");
    expect(result).toEqual([]);
  });

  it("returns team members with full names", async () => {
    const callCount: Record<string, number> = {};

    const supabase = createMockClient({
      company_users: (chain: any) => {
        callCount.company_users = (callCount.company_users || 0) + 1;
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [{ user_id: "u1" }, { user_id: "u2" }],
            error: null,
          }).then(cb);
        return chain;
      },
      user_profiles: (chain: any) => {
        callCount.user_profiles = (callCount.user_profiles || 0) + 1;
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { id: "u1", email: "alice@test.com", full_name: "Alice Smith" },
              { id: "u2", email: "bob@test.com", full_name: "Bob Jones" },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
    });

    const result = await getTeamMembers(supabase, "c1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "u1",
      email: "alice@test.com",
      fullName: "Alice Smith",
    });
    expect(result[1]).toEqual({
      id: "u2",
      email: "bob@test.com",
      fullName: "Bob Jones",
    });
  });

  it("uses email as fullName when full_name is null", async () => {
    const supabase = createMockClient({
      company_users: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [{ user_id: "u1" }],
            error: null,
          }).then(cb);
        return chain;
      },
      user_profiles: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [{ id: "u1", email: "alice@test.com", full_name: null }],
            error: null,
          }).then(cb);
        return chain;
      },
    });

    const result = await getTeamMembers(supabase, "c1");
    expect(result[0].fullName).toBe("alice@test.com");
  });
});

// ─── getJobsWithCustomers ───────────────────────────────────────────────────────

describe("getJobsWithCustomers", () => {
  it("returns empty array when no jobs found", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: null, error: null }).then(cb);
        return chain;
      },
    });

    const result = await getJobsWithCustomers(supabase, "c1");
    expect(result).toEqual([]);
  });

  it("returns jobs with customer data attached", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { id: "j1", customer_id: "cust-1", company_id: "c1" },
              { id: "j2", customer_id: null, company_id: "c1" },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
      customers: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [{ id: "cust-1", name: "Alice" }],
            error: null,
          }).then(cb);
        return chain;
      },
      estimates: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              {
                id: "est-1",
                job_id: "j1",
                status: "sent",
                denied_at: null,
                denial_reason: null,
              },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
    });

    const result = await getJobsWithCustomers(supabase, "c1");

    expect(result).toHaveLength(2);
    expect(result[0].customer).toEqual({ id: "cust-1", name: "Alice" });
    expect(result[0].latestEstimate).toEqual({
      id: "est-1",
      status: "sent",
      denied_at: null,
      denial_reason: null,
    });
    expect(result[1].customer).toBeNull();
    expect(result[1].latestEstimate).toBeNull();
  });
});

// ─── getScheduledJobs ───────────────────────────────────────────────────────────

describe("getScheduledJobs", () => {
  it("returns empty array when no scheduled jobs", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getScheduledJobs(supabase, "c1");
    expect(result).toEqual([]);
  });

  it("returns scheduled jobs with customer data", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              {
                id: "j1",
                customer_id: "cust-1",
                scheduled_date: "2026-03-15",
                status: "scheduled",
              },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
      customers: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [{ id: "cust-1", name: "Bob" }],
            error: null,
          }).then(cb);
        return chain;
      },
    });

    const result = await getScheduledJobs(supabase, "c1");

    expect(result).toHaveLength(1);
    expect(result[0].customer).toEqual({ id: "cust-1", name: "Bob" });
  });
});

// ─── getDashboardData ───────────────────────────────────────────────────────────

describe("getDashboardData", () => {
  it("calculates active jobs count correctly", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { id: "j1", status: "scheduled", payment_state: null, payment_amount: null },
              { id: "j2", status: "in_progress", payment_state: null, payment_amount: null },
              { id: "j3", status: "new", payment_state: null, payment_amount: null },
              { id: "j4", status: "done", payment_state: null, payment_amount: null },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");

    // Only "scheduled" and "in_progress" are active
    expect(result.activeJobs).toBe(2);
  });

  it("calculates outstanding payments correctly", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { id: "j1", status: "done", payment_state: "due", payment_amount: 5000 },
              { id: "j2", status: "done", payment_state: "due", payment_amount: 3000 },
              { id: "j3", status: "done", payment_state: "paid", payment_amount: 2000 },
              { id: "j4", status: "new", payment_state: null, payment_amount: null },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");

    // Only due payments: 5000 + 3000 = 8000
    expect(result.outstandingPayments).toBe(8000);
  });

  it("identifies low inventory items", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { id: "i1", name: "Paint", on_hand: 2, reorder_at: 5, unit: "gallons" },
              { id: "i2", name: "Brushes", on_hand: 10, reorder_at: 3, unit: "pcs" },
              { id: "i3", name: "Tape", on_hand: 1, reorder_at: 10, unit: "rolls" },
              { id: "i4", name: "Nothing", on_hand: 0, reorder_at: 0, unit: "pcs" },
            ],
            error: null,
          }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");

    // Paint (2 <= 5) and Tape (1 <= 10) are low. Nothing (0 <= 0 with reorder_at=0) is not flagged.
    expect(result.lowInventoryCount).toBe(2);
    expect(result.lowInventoryItems).toHaveLength(2);
  });

  it("limits low inventory items to 5 for display", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `i-${i}`,
      name: `Item ${i}`,
      on_hand: 1,
      reorder_at: 10,
      unit: "pcs",
    }));

    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: items, error: null }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");

    expect(result.lowInventoryCount).toBe(10);
    expect(result.lowInventoryItems).toHaveLength(5);
  });

  it("calculates time tracking correctly", async () => {
    const now = new Date();
    const todayISO = now.toISOString();

    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({
            data: [
              { duration_seconds: 3600, started_at: todayISO }, // 1 hour today
              { duration_seconds: 7200, started_at: todayISO }, // 2 hours today
            ],
            error: null,
          }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");

    expect(result.todayHours).toBe(3); // 3600 + 7200 = 10800 seconds = 3 hours
    expect(result.hasTimeTracking).toBe(true);
  });

  it("returns hasTimeTracking false when no entries", async () => {
    const supabase = createMockClient({
      jobs: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      inventory_items: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
      time_entries: (chain: any) => {
        chain.then = (cb: any) =>
          Promise.resolve({ data: [], error: null }).then(cb);
        return chain;
      },
    });

    const result = await getDashboardData(supabase, "c1");
    expect(result.hasTimeTracking).toBe(false);
    expect(result.todayHours).toBe(0);
    expect(result.weekHours).toBe(0);
  });
});
