# DRIP Platform Architecture - Core/Product Split

**Date:** 2026-01-16
**Status:** Design Complete, Implementation In Progress
**Goal:** Enable multiple products (Matte, Pour) sharing a single core codebase

---

## Executive Summary

The Drip platform is being refactored from a monolithic painting application (Matte) into a multi-product platform where:

- **Core** owns all shared business logic (auth, jobs, invoices, payments, scheduling)
- **Matte** (painting product) consumes core and adds painting-specific features
- **Pour** (concrete product) will be a new app consuming the same core

**Key Constraint:** Matte must remain stable and production-safe throughout this refactoring.

---

## Current State Analysis

### What We Have Today

The codebase is currently a Next.js 15 application with:
- **Name:** "matte" (painting-focused)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Payments:** Stripe Connect
- **Location:** Single `/src` directory with all code

### Code Breakdown by Category

**~60-70% Core (Trade-Agnostic):**
- Company management & multi-tenancy
- User authentication & team management
- Customer CRM
- Job lifecycle (base fields: status, assignment, dates)
- Invoicing & payment processing
- Stripe integration
- Calendar & scheduling
- File attachments & photos
- Time tracking

**~30-40% Product-Specific (Painting):**
- Matte AI assistant (`/src/lib/matte/`)
- Estimate materials generation (`/src/lib/estimate-materials.ts`)
- Area-based pricing (walls/ceilings/trim rates)
- Paint-specific fields:
  - `paint_color_name_or_code`
  - `sheen` (Eggshell, Satin, etc.)
  - `product_line` (Duration, Emerald, etc.)
  - `gallons_estimate`
- Weather alerts for outdoor painting jobs
- Inventory categories (paint, primer, sundries, tools)
- Pickup locations (Sherwin-Williams integration)

---

## Target Architecture

### Monorepo Structure

```
drip/
├── packages/
│   ├── core/                      # Shared business logic
│   │   ├── src/
│   │   │   ├── auth/             # Authentication utilities
│   │   │   ├── database/         # Supabase client & queries
│   │   │   ├── domain/           # Business logic
│   │   │   │   ├── companies/
│   │   │   │   ├── customers/
│   │   │   │   ├── jobs/         # Base job logic
│   │   │   │   ├── estimates/    # Base estimate logic
│   │   │   │   ├── invoices/
│   │   │   │   ├── payments/
│   │   │   │   ├── schedules/
│   │   │   │   └── users/
│   │   │   ├── integrations/     # External services
│   │   │   │   └── stripe/
│   │   │   ├── types/            # Shared TypeScript types
│   │   │   └── utils/            # Shared utilities
│   │   └── package.json          # @drip/core
│   │
│   └── ui/                        # Shared UI components (optional)
│       ├── src/
│       │   ├── components/       # Reusable primitives
│       │   └── lib/              # UI utilities
│       └── package.json          # @drip/ui
│
├── apps/
│   ├── matte/                     # Painting product
│   │   ├── src/
│   │   │   ├── app/              # Next.js App Router
│   │   │   ├── components/       # Matte-specific components
│   │   │   ├── features/         # Painting-specific features
│   │   │   │   ├── ai-assistant/ # Matte AI
│   │   │   │   ├── materials/    # Paint materials
│   │   │   │   ├── estimating/   # Area-based pricing
│   │   │   │   └── weather/      # Weather alerts
│   │   │   └── lib/              # Matte utilities
│   │   ├── public/
│   │   └── package.json          # Dependencies: @drip/core
│   │
│   └── pour/                      # Concrete product (future)
│       ├── src/
│       │   ├── app/              # Next.js App Router
│       │   ├── components/       # Pour-specific components
│       │   ├── features/         # Concrete-specific features
│       │   └── lib/              # Pour utilities
│       ├── public/
│       └── package.json          # Dependencies: @drip/core
│
├── supabase/                      # Shared database
│   └── migrations/
│
├── package.json                   # Root workspace config
└── pnpm-workspace.yaml           # Workspace definition
```

---

## Core Package Design

### Responsibilities

The `@drip/core` package owns:

1. **Authentication & Authorization**
   - Supabase client creation (server/client)
   - Auth middleware
   - Session management
   - RLS policy helpers

2. **Database Layer**
   - Type-safe query builders
   - Core table operations
   - Transaction helpers
   - Migration utilities

3. **Domain Logic**
   - Company management (multi-tenant)
   - Customer CRUD
   - Job lifecycle (base fields only)
   - Estimate lifecycle (base fields only)
   - Invoice generation & management
   - Payment processing (Stripe)
   - Schedule management
   - Team/crew management
   - File attachments

4. **Integrations**
   - Stripe Connect setup
   - Webhook handlers (generic)
   - Email notifications (transactional)

5. **Utilities**
   - Date/time formatting
   - Currency formatting
   - Token generation
   - Validation schemas (Zod)

### API Design

```typescript
// Example: Core job module
// @drip/core/src/domain/jobs/index.ts

export interface BaseJob {
  id: string;
  company_id: string;
  customer_id: string;
  title: string;
  status: JobStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_user_ids: string[];
  created_at: string;
  updated_at: string;

  // Products can extend with their own fields
  product_metadata?: Record<string, any>;
}

export type JobStatus =
  | 'new'
  | 'quoted'
  | 'scheduled'
  | 'in_progress'
  | 'done'
  | 'paid'
  | 'archive';

export async function createJob(
  supabase: SupabaseClient,
  data: CreateJobInput
): Promise<BaseJob> {
  // Core job creation logic
}

export async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  newStatus: JobStatus
): Promise<void> {
  // Status transition logic + validations
}

// Products can import and extend
```

### No Product-Specific Logic in Core

Core must NOT contain:
- ❌ Paint colors, sheen, gallons
- ❌ Area types (walls, ceilings, trim)
- ❌ Concrete-specific fields
- ❌ AI assistants (product-specific)
- ❌ Weather alerts (product-specific)
- ❌ Product-specific pricing logic

---

## Matte App Design

### Responsibilities

The `apps/matte` app owns:

1. **Painting-Specific Features**
   - Matte AI assistant (natural language queries)
   - Paint material auto-generation
   - Area-based estimating (sqft pricing)
   - Weather alerts for outdoor jobs
   - Pickup locations (Sherwin-Williams)

2. **Painting-Specific UI**
   - Estimate builder with paint fields
   - Material shopping lists
   - Inventory management (paint/primer)
   - Paint chip animations

3. **Configuration**
   - Estimating rates (walls/ceilings/trim)
   - Paint product catalogs
   - Sheen options
   - Vendor integrations

### Dependencies

```json
{
  "name": "matte",
  "dependencies": {
    "@drip/core": "workspace:*",
    "@drip/ui": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "openai": "^4.0.0",
    "// Weather API": "for outdoor jobs"
  }
}
```

### Example: Extending Core

```typescript
// apps/matte/src/features/estimating/area-based-pricing.ts
import { createEstimate, type BaseEstimate } from '@drip/core';

export interface MatteEstimate extends BaseEstimate {
  line_items: MatteLineItem[];
}

export interface MatteLineItem {
  // Core fields
  id: string;
  description: string;
  quantity: number;
  price: number;

  // Matte-specific fields
  area_type: 'walls' | 'ceilings' | 'trim';
  sqft: number;
  paint_color_name_or_code: string;
  sheen: 'Flat' | 'Eggshell' | 'Satin' | 'Semi-Gloss';
  product_line: string;
  gallons_estimate: number;
}

export async function createMatteEstimate(data: CreateMatteEstimateInput) {
  // Use core estimate creation
  const baseEstimate = await createEstimate(supabase, {
    company_id: data.company_id,
    job_id: data.job_id,
    // ... base fields
  });

  // Add Matte-specific line items
  await createMatteLineItems(baseEstimate.id, data.line_items);

  // Auto-generate materials
  await generatePaintMaterials(baseEstimate.id);

  return baseEstimate;
}
```

---

## Pour App Design (Future)

### Initial Scope (MVP Shell)

The `apps/pour` app will initially be a minimal shell that:

1. ✅ Boots successfully
2. ✅ Authenticates users (via `@drip/core`)
3. ✅ Creates companies & customers
4. ✅ Creates basic jobs (using core job model)
5. ✅ Creates basic invoices
6. ✅ Processes payments (via core Stripe integration)

### Concrete-Specific Features (Future)

Later, Pour will add:
- Concrete-specific estimating (cubic yards, PSI, mix designs)
- Equipment scheduling
- Material tracking (aggregate, cement, admixtures)
- Truck dispatch
- Pour scheduling with weather considerations

### No Duplication

Pour must NOT:
- ❌ Reimplement auth
- ❌ Reimplement payments
- ❌ Reimplement job lifecycle
- ❌ Reimplement invoicing

It should import from `@drip/core` for all shared logic.

---

## Database Strategy

### Current State

Single Supabase database with all tables:
- Core tables: `companies`, `users`, `customers`, `jobs`, `invoices`, etc.
- Matte-specific tables: `estimate_materials`, `estimating_config`, `pickup_locations`

### Target State

**Approach: Shared Database with Product-Specific Extensions**

#### Core Tables (Used by All Products)

```sql
-- Core, no changes needed
companies
user_profiles
company_users
invite_links
customers
jobs (with product_id field added)
invoices
invoice_payments
schedules
job_photos
```

#### Product Identification

Add `product_id` to relevant tables:

```sql
-- Migration: Add product tracking
ALTER TABLE companies
  ADD COLUMN product_id TEXT NOT NULL DEFAULT 'matte'
  CHECK (product_id IN ('matte', 'pour'));

ALTER TABLE jobs
  ADD COLUMN product_id TEXT NOT NULL DEFAULT 'matte'
  CHECK (product_id IN ('matte', 'pour'));

-- Index for filtering
CREATE INDEX idx_jobs_product_id ON jobs(product_id);
```

#### Product-Specific Tables

Use naming convention: `{entity}_{product}`

```sql
-- Matte (Painting) specific
estimate_line_items_matte (
  id UUID PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id),
  area_type TEXT,
  sqft DECIMAL,
  paint_color_name_or_code TEXT,
  sheen TEXT,
  product_line TEXT,
  gallons_estimate DECIMAL,
  cost_per_gallon DECIMAL
);

estimate_materials_matte (
  id UUID PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id),
  paint_product TEXT,
  color_name TEXT,
  sheen TEXT,
  quantity_gallons DECIMAL
);

estimating_config_matte (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  walls_rate_per_sqft DECIMAL,
  ceilings_rate_per_sqft DECIMAL,
  trim_rate_per_sqft DECIMAL
);

-- Pour (Concrete) specific (future)
estimate_line_items_pour (
  id UUID PRIMARY KEY,
  estimate_id UUID REFERENCES estimates(id),
  cubic_yards DECIMAL,
  psi_rating INTEGER,
  mix_design TEXT,
  finish_type TEXT
);
```

#### Polymorphic Data Pattern

For flexible product-specific data:

```sql
-- Core estimates table
CREATE TABLE estimates (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  job_id UUID REFERENCES jobs(id),
  product_id TEXT NOT NULL,

  -- Core fields
  total_amount DECIMAL,
  labor_cost DECIMAL,
  materials_cost DECIMAL,
  status TEXT,
  created_at TIMESTAMPTZ,

  -- Flexible product-specific data
  product_metadata JSONB DEFAULT '{}'::jsonb
);

-- Matte uses estimate_line_items_matte
-- Pour uses estimate_line_items_pour
```

### Migration Strategy

1. **Phase 1: Add product_id columns** (non-breaking)
   - Default to 'matte' for existing data
   - Add constraints for valid product values

2. **Phase 2: Create product-specific tables** (non-breaking)
   - Migrate existing data (e.g., `estimate_line_items` → `estimate_line_items_matte`)
   - Keep old tables for rollback safety

3. **Phase 3: Update application code** (non-breaking)
   - Matte reads from `estimate_line_items_matte`
   - Core reads only base fields

4. **Phase 4: Drop deprecated columns** (after verification)
   - Only after Matte is stable on new structure

---

## Implementation Plan

### Phase 1: Monorepo Setup ✅ CURRENT

**Tasks:**
1. ✅ Create workspace structure
2. ✅ Set up `packages/core` package
3. ✅ Set up `apps/matte` directory
4. ✅ Set up `apps/pour` directory (shell)
5. ✅ Configure workspace dependencies
6. ✅ Set up build tooling

**Outcome:** Build succeeds, nothing broken yet

---

### Phase 2: Extract Core Utilities (Low Risk)

**Tasks:**
1. Move `/src/lib/supabase/` → `packages/core/src/database/`
2. Move `/src/lib/utils.ts` → `packages/core/src/utils/`
3. Move `/src/types/database.ts` → `packages/core/src/types/`
4. Update imports in Matte app

**Outcome:** Matte imports from `@drip/core` for utilities

---

### Phase 3: Extract Core Domain Logic

**Tasks:**
1. Create `packages/core/src/domain/companies/`
   - Move company queries
   - Move invite logic

2. Create `packages/core/src/domain/customers/`
   - Move customer CRUD
   - Move customer queries

3. Create `packages/core/src/domain/jobs/`
   - Extract base job logic (no painting-specific)
   - Leave `product_metadata` for extensions

4. Create `packages/core/src/domain/invoices/`
   - Move invoice generation
   - Move payment tracking

5. Create `packages/core/src/domain/payments/`
   - Move Stripe integration
   - Move webhook handlers

**Outcome:** Core owns all business logic, Matte imports it

---

### Phase 4: Isolate Matte-Specific Features

**Tasks:**
1. Keep in `apps/matte/src/features/`:
   - `ai-assistant/` - Matte AI
   - `materials/` - Paint material generation
   - `estimating/` - Area-based pricing
   - `weather/` - Weather alerts

2. Update database queries to use product-specific tables

**Outcome:** Clear boundary between core and Matte

---

### Phase 5: Update Database Schema

**Tasks:**
1. Write migration to add `product_id` columns
2. Create `estimate_line_items_matte` table
3. Migrate existing data
4. Update Matte queries to use new tables

**Outcome:** Database supports multiple products

---

### Phase 6: Stand Up Pour Shell

**Tasks:**
1. Create `apps/pour/src/app` with basic routes
2. Implement auth (using `@drip/core`)
3. Create job/customer pages (using core components)
4. Stub out concrete-specific features
5. Deploy as separate Vercel project

**Outcome:** Pour can boot, auth, and create basic entities

---

### Phase 7: Testing & Documentation

**Tasks:**
1. Test Matte thoroughly (regression testing)
2. Verify Pour can authenticate and create jobs
3. Document architecture (this file)
4. Document product extension guide
5. Create developer onboarding guide

**Outcome:** Complete, documented, stable multi-product platform

---

## Product Extension Guide

### How to Add a New Product

1. **Create app directory**
   ```bash
   mkdir -p apps/new-product/src
   ```

2. **Add to workspace**
   ```yaml
   # pnpm-workspace.yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```

3. **Install core dependency**
   ```json
   {
     "dependencies": {
       "@drip/core": "workspace:*"
     }
   }
   ```

4. **Implement product-specific features**
   - Create `src/features/` directory
   - Import core domain logic
   - Extend with product-specific fields

5. **Add product identifier**
   ```sql
   ALTER TABLE companies
     ALTER COLUMN product_id
     DROP CONSTRAINT companies_product_id_check,
     ADD CONSTRAINT companies_product_id_check
     CHECK (product_id IN ('matte', 'pour', 'new-product'));
   ```

---

## Critical Principles

### ✅ DO

- Import from `@drip/core` for all shared logic
- Use `product_metadata` JSONB fields for flexibility
- Keep product-specific code in `apps/{product}/`
- Write tests for core logic
- Document product-specific extensions
- Use TypeScript strictly

### ❌ DON'T

- Put product-specific logic in `@drip/core`
- Duplicate business logic across products
- Modify core without considering all products
- Make breaking changes to core without migration plan
- Skip tests
- Add speculative abstractions

---

## Success Metrics

### Phase 1 Success (Monorepo Setup)
- ✅ Build completes successfully
- ✅ All tests pass
- ✅ Matte deploys to production
- ✅ No user-facing changes

### Phase 2-5 Success (Core Extraction)
- ✅ Matte behaves identically to before
- ✅ All Matte features work (AI, materials, weather)
- ✅ Performance unchanged
- ✅ All API endpoints functional
- ✅ All tests pass

### Phase 6 Success (Pour Shell)
- ✅ Pour app boots successfully
- ✅ Can create account and authenticate
- ✅ Can create companies, customers, jobs
- ✅ Can generate invoices
- ✅ Can process payments
- ✅ Deployed as separate Vercel project

### Final Success Criteria
- ✅ Two production apps (Matte + Pour)
- ✅ Shared core codebase
- ✅ Clear architectural boundaries
- ✅ Zero Matte regressions
- ✅ Documentation complete
- ✅ Team can extend with confidence

---

## Risks & Mitigations

### Risk: Breaking Matte During Refactor

**Mitigation:**
- Incremental changes with frequent testing
- Feature flags for risky changes
- Automated regression tests
- Keep old code until new code proven
- Rollback plan for every deployment

### Risk: Over-Abstraction

**Mitigation:**
- Only abstract what's clearly shared
- Keep painting-specific code in Matte
- Use `product_metadata` for flexibility
- Favor duplication over premature abstraction

### Risk: Database Migration Failures

**Mitigation:**
- Write reversible migrations
- Test on staging database first
- Add columns before dropping
- Keep old tables during transition
- Monitor query performance

### Risk: Team Confusion

**Mitigation:**
- Clear documentation (this file)
- Code review guidelines
- Onboarding guide
- Architecture decision records
- Regular team sync on boundaries

---

## Future Considerations

### Multi-Product Companies (Future)

If a company needs both Matte and Pour:

```sql
-- Instead of product_id on company
CREATE TABLE company_products (
  company_id UUID REFERENCES companies(id),
  product_id TEXT,
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (company_id, product_id)
);
```

### White-Label / Custom Branding (Future)

Product apps could support custom branding:

```typescript
interface ProductConfig {
  name: string;
  brandColor: string;
  logo: string;
  // ...
}
```

### Marketplace / Plugin System (Future)

Third-party developers could build product extensions:

```typescript
interface ProductPlugin {
  id: string;
  name: string;
  extendEstimate?: EstimateExtension;
  extendJob?: JobExtension;
  // ...
}
```

---

## Appendix: Code Examples

### Example 1: Core Job Creation

```typescript
// packages/core/src/domain/jobs/create-job.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface CreateJobInput {
  company_id: string;
  customer_id: string;
  title: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  product_id: 'matte' | 'pour';
  product_metadata?: Record<string, any>;
}

export async function createJob(
  supabase: SupabaseClient,
  input: CreateJobInput
) {
  // Validate company access
  await validateCompanyAccess(supabase, input.company_id);

  // Validate customer exists
  await validateCustomerExists(supabase, input.customer_id);

  // Create job
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: input.company_id,
      customer_id: input.customer_id,
      title: input.title,
      description: input.description,
      status: 'new',
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      product_id: input.product_id,
      product_metadata: input.product_metadata || {},
    })
    .select()
    .single();

  if (error) throw error;

  // Trigger notifications
  await notifyJobCreated(supabase, data.id);

  return data;
}
```

### Example 2: Matte Job Extension

```typescript
// apps/matte/src/features/jobs/create-matte-job.ts
import { createJob, type CreateJobInput } from '@drip/core';

export interface CreateMatteJobInput extends Omit<CreateJobInput, 'product_id'> {
  is_outdoor: boolean;
  pickup_location_id?: string;
}

export async function createMatteJob(
  supabase: SupabaseClient,
  input: CreateMatteJobInput
) {
  // Use core job creation
  const job = await createJob(supabase, {
    ...input,
    product_id: 'matte',
    product_metadata: {
      is_outdoor: input.is_outdoor,
      pickup_location_id: input.pickup_location_id,
    },
  });

  // Matte-specific: Set up weather alerts if outdoor
  if (input.is_outdoor) {
    await setupWeatherAlerts(job.id);
  }

  return job;
}
```

### Example 3: Pour Job Extension

```typescript
// apps/pour/src/features/jobs/create-pour-job.ts
import { createJob, type CreateJobInput } from '@drip/core';

export interface CreatePourJobInput extends Omit<CreateJobInput, 'product_id'> {
  cubic_yards: number;
  mix_design: string;
  truck_count: number;
}

export async function createPourJob(
  supabase: SupabaseClient,
  input: CreatePourJobInput
) {
  // Use core job creation
  const job = await createJob(supabase, {
    ...input,
    product_id: 'pour',
    product_metadata: {
      cubic_yards: input.cubic_yards,
      mix_design: input.mix_design,
      truck_count: input.truck_count,
    },
  });

  // Pour-specific: Reserve trucks
  await reserveTrucks(job.id, input.truck_count);

  return job;
}
```

---

## Conclusion

This architecture enables:
- **Matte** to remain stable and production-safe
- **Pour** to be built without duplicating core logic
- **Future products** to be added cleanly
- **Core improvements** to benefit all products
- **Product-specific innovation** without constraints

The key insight: **~60% of the codebase is trade-agnostic and can be shared. ~40% is product-specific and should stay isolated.**

This split is not about premature abstraction—it's about creating clear boundaries that allow the platform to grow sustainably.
