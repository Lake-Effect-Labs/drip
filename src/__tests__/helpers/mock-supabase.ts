import { vi } from "vitest";

/**
 * Chainable mock builder for Supabase query methods.
 * Each method records its call and returns `this` for chaining,
 * finally resolving with the configured data/error.
 */
export function createChainableMock(resolveWith: { data?: any; error?: any; count?: number | null } = {}) {
  const { data = null, error = null, count = null } = resolveWith;
  const result = { data, error, count };

  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve(result).then(cb)),
  };

  // Make chain itself thenable (so `await supabase.from(...).select(...)...` works)
  // Attach [Symbol.toStringTag] for async iteration
  chain[Symbol.toPrimitive] = () => result;

  return chain;
}

/**
 * Creates a mock Supabase client where `from(tableName)` returns
 * the configured chainable mock for that table.
 */
export function createMockSupabaseClient(tableResults: Record<string, { data?: any; error?: any; count?: number | null }> = {}) {
  const tableMocks: Record<string, any> = {};

  for (const [table, result] of Object.entries(tableResults)) {
    tableMocks[table] = createChainableMock(result);
  }

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (tableMocks[table]) return tableMocks[table];
      // Default: return empty data
      return createChainableMock({ data: null, error: null });
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      }),
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/storage/file.jpg" } }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: { company_id: "company-123" }, error: null }),
    _tableMocks: tableMocks,
  };

  return client;
}

/** Convenience: creates a user-authenticated + admin Supabase pair */
export function createMockSupabasePair(
  tableResults: Record<string, { data?: any; error?: any; count?: number | null }> = {},
  userOverride?: { id: string; email: string } | null,
) {
  const userClient = createMockSupabaseClient(tableResults);
  const adminClient = createMockSupabaseClient(tableResults);

  if (userOverride === null) {
    // Simulate unauthenticated user
    userClient.auth.getUser.mockResolvedValue({ data: { user: null } });
  } else if (userOverride) {
    userClient.auth.getUser.mockResolvedValue({ data: { user: userOverride } });
  }

  return { userClient, adminClient };
}
