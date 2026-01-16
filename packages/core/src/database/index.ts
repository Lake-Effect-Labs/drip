/**
 * Database module
 * Provides Supabase client creation and core database queries
 *
 * IMPORTANT: This file re-exports from both client and server modules.
 * - For server-side code, import from '@drip/core/database/server'
 * - For client-side code, import from '@drip/core/database/client'
 * - Queries can be used in both contexts
 */

// Re-export queries (can be used in both client and server)
export * from './queries';

// Re-export client (for browser/client components)
export { createClient as createBrowserClient } from './client';

// NOTE: Server exports are NOT re-exported here to avoid Next.js bundle issues
// Import server functions directly: import { createClient, createAdminClient } from '@drip/core/database/server'
