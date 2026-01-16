/**
 * @drip/core
 *
 * Core business logic shared across all Drip products (Matte, Pour, etc.)
 *
 * This package contains:
 * - Authentication & authorization
 * - Database client & queries
 * - Domain logic (companies, customers, jobs, invoices, payments)
 * - Integrations (Stripe, email)
 * - Shared types & utilities
 *
 * Usage:
 * ```ts
 * import { createClient } from '@drip/core/database';
 * import { formatCurrency } from '@drip/core/utils';
 * import type { Database } from '@drip/core/types';
 * ```
 */

// Export version
export const VERSION = '0.1.0';
