# Core/Product Split - Implementation Status

**Date:** 2026-01-16
**Status:** Phase 1 Complete (Monorepo Setup) - Phase 2 In Progress (Import Resolution)

---

## ✅ Completed

### 1. Monorepo Structure
- Created `packages/core` directory for shared business logic
- Created `apps/matte` directory for painting product
- Created `apps/pour` directory for concrete product (shell)
- Configured npm workspaces in root `package.json`
- Set up package dependencies and TypeScript configuration

### 2. Core Package (@drip/core)
Successfully extracted and created:
- **Database Module** (`src/database/`)
  - `client.ts` - Browser-side Supabase client
  - `server.ts` - Server-side Supabase client (SSR-ready)
  - `queries.ts` - Shared database queries
  - Exports: `@drip/core/database/client`, `@drip/core/database/server`, `@drip/core/database/queries`

- **Auth Module** (`src/auth/`)
  - `middleware.ts` - Next.js middleware for session management
  - Export: `@drip/core/auth`

- **Types Module** (`src/types/`)
  - `database.ts` - Full database TypeScript types
  - Export: `@drip/core/types`

- **Utils Module** (`src/utils/`)
  - Core formatting functions (currency, date, phone)
  - Job status constants and helpers
  - Token generation, clipboard, slugify utilities
  - Export: `@drip/core/utils`

### 3. Matte App Refactoring
- Moved all source code from root `src/` to `apps/matte/src/`
- Updated `middleware.ts` to use `@drip/core/auth`
- Refactored `lib/utils.ts` to re-export core utils and keep only painting-specific constants:
  - `SERVICE_TYPES` (painting services)
  - `PAINT_SHEENS` (paint finish options)
  - `THEMES` (Sherwin-Williams color themes)
  - `COMMON_MATERIALS` (painting materials)
- Automated import updates:
  - Changed 71 files from `@/lib/supabase/*` to `@drip/core/database/*`
  - Changed 31 files from `@/types/database` to `@drip/core/types`

### 4. Architecture Documentation
- Created comprehensive `ARCHITECTURE.md` covering:
  - Current state analysis (60% core, 40% product-specific)
  - Target monorepo structure
  - Core package design principles
  - Product extension patterns
  - Database strategy
  - Implementation phases
  - Code examples

---

## 🚧 In Progress

### Next.js Client/Server Import Resolution
**Issue:** Some files are importing server-only code (`@drip/core/database/server`) in client contexts, causing build errors.

**Affected Files:**
- `apps/matte/src/app/app/jobs/new/page.tsx` - Needs client import
- Several auth pages (partially fixed)
- Possibly other "use client" components

**Solution Required:**
1. Identify all "use client" components that import from `/server`
2. Change them to import from `/client` instead
3. For pages that need both client and server data, consider:
   - Moving data fetching to parent server component
   - Using Server Actions for mutations
   - Splitting into separate client/server components

**Commands to Help:**
```bash
# Find "use client" components importing server code
cd apps/matte
grep -l "\"use client\"" src/**/*.tsx | xargs grep -l "@drip/core/database/server"

# Fix them by changing to client import
sed -i 's|@drip/core/database/server|@drip/core/database/client|g' [filename]
```

---

## 📋 Remaining Tasks

### Phase 2: Complete Matte Migration (HIGH PRIORITY)

**1. Fix Build Errors**
- [ ] Resolve all client/server import conflicts
- [ ] Test `npm run build --workspace=apps/matte`
- [ ] Ensure no TypeScript errors
- [ ] Fix font loading issue (network-related, low priority)

**2. Test Matte Functionality**
- [ ] Verify auth flows (login, signup, password reset)
- [ ] Test job creation and management
- [ ] Test estimate generation and materials
- [ ] Test invoice creation and payments
- [ ] Verify Matte AI assistant works
- [ ] Check weather alerts functionality
- [ ] Test inventory management

**3. Deploy Matte**
- [ ] Update Vercel configuration for monorepo
- [ ] Set root directory to `apps/matte`
- [ ] Test deployment
- [ ] Verify production functionality

### Phase 3: Create Pour App Shell (MEDIUM PRIORITY)

**1. Basic App Structure**
- [ ] Create `apps/pour/src/app` directory structure
- [ ] Set up authentication pages (reuse from Matte or core)
- [ ] Create basic layout and routing
- [ ] Configure Tailwind CSS
- [ ] Set up environment variables

**2. Core Feature Integration**
- [ ] Implement company/user onboarding (use `@drip/core`)
- [ ] Create customer management pages
- [ ] Create basic job pages (without concrete-specific fields yet)
- [ ] Set up invoice generation
- [ ] Integrate Stripe payments (via `@drip/core`)

**3. Deploy Pour Shell**
- [ ] Create separate Vercel project
- [ ] Configure build settings
- [ ] Deploy and test
- [ ] Verify core features work

### Phase 4: Database Schema Updates (MEDIUM PRIORITY)

**Migration: Add Product Tracking**

Create a new Supabase migration (`supabase/migrations/XXX_add_product_tracking.sql`):

```sql
-- Add product_id to companies table
ALTER TABLE companies
  ADD COLUMN product_id TEXT NOT NULL DEFAULT 'matte'
  CHECK (product_id IN ('matte', 'pour'));

-- Add product_id to jobs table (for multi-product companies)
ALTER TABLE jobs
  ADD COLUMN product_id TEXT NOT NULL DEFAULT 'matte'
  CHECK (product_id IN ('matte', 'pour'));

-- Add indexes for efficient filtering
CREATE INDEX idx_companies_product_id ON companies(product_id);
CREATE INDEX idx_jobs_product_id ON jobs(product_id);

-- Add product_metadata JSONB column for flexible extensions
ALTER TABLE jobs
  ADD COLUMN product_metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE estimates
  ADD COLUMN product_metadata JSONB DEFAULT '{}'::jsonb;

-- Backfill existing data
UPDATE companies SET product_id = 'matte' WHERE product_id IS NULL;
UPDATE jobs SET product_id = 'matte' WHERE product_id IS NULL;

-- Update RLS policies to include product filtering (if needed)
-- Example: If a company has access to multiple products
-- CREATE POLICY ...
```

**Painting-Specific Tables**

Consider renaming existing tables for clarity:

```sql
-- Option 1: Rename existing tables
ALTER TABLE estimate_materials RENAME TO estimate_materials_matte;
ALTER TABLE estimating_config RENAME TO estimating_config_matte;

-- Option 2: Create product-specific extensions
-- (Keep base tables, add product-specific columns via new tables)
```

### Phase 5: Documentation & Handoff (LOW PRIORITY)

**1. Developer Guide**
- [ ] Write "Adding a New Product" tutorial
- [ ] Document core package usage patterns
- [ ] Create troubleshooting guide
- [ ] Add code examples for common scenarios

**2. Deployment Guide**
- [ ] Document Vercel configuration for both apps
- [ ] Environment variable setup guide
- [ ] Database migration procedures
- [ ] Rollback procedures

**3. Team Onboarding**
- [ ] Create video walkthrough (optional)
- [ ] Review session with team
- [ ] Q&A document

---

## 🐛 Known Issues

### 1. Build Failures
**Status:** Blocking deployment
**Priority:** HIGH
**Description:** Next.js build fails due to client components importing server-only code
**Fix:** Update imports to use `@drip/core/database/client` in "use client" files

### 2. Font Loading
**Status:** Non-blocking (warning only)
**Priority:** LOW
**Description:** DM Sans font fails to load from Google Fonts (TLS/network issue)
**Fix:** Either:
- Set `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1`
- Or add `experimental.turbopackUseSystemTlsCerts` to `next.config.js`
- Or use local font files instead

### 3. Type Resolution
**Status:** Unknown (test after build fixes)
**Priority:** MEDIUM
**Description:** TypeScript may have issues resolving types from workspace packages
**Fix:** Ensure `tsconfig.json` paths are correctly configured in both apps

---

## 📊 Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| **1. Monorepo Setup** | ✅ Complete | 100% |
| **2. Core Extraction** | ✅ Complete | 100% |
| **3. Matte Migration** | 🚧 In Progress | 85% |
| **4. Build Resolution** | 🚧 In Progress | 40% |
| **5. Matte Testing** | ⏳ Pending | 0% |
| **6. Pour Shell** | ⏳ Pending | 0% |
| **7. Database Schema** | ⏳ Pending | 0% |
| **8. Documentation** | 🚧 In Progress | 30% |

**Overall Progress:** ~60%

---

## 🎯 Next Steps (Recommended Order)

1. **IMMEDIATE: Fix Build Issues**
   ```bash
   cd apps/matte
   # Find problematic files
   grep -l "\"use client\"" src/**/*.tsx | xargs grep -l "@drip/core/database/server"

   # Fix each file
   # Change: import { createClient } from "@drip/core/database/server"
   # To:     import { createClient } from "@drip/core/database/client"
   ```

2. **TEST: Verify Matte Build**
   ```bash
   npm run build --workspace=apps/matte
   ```

3. **VALIDATE: Test Matte Locally**
   ```bash
   npm run dev --workspace=apps/matte
   # Visit http://localhost:3000
   # Test all critical flows
   ```

4. **DEPLOY: Matte to Production**
   - Update Vercel settings
   - Set root directory: `apps/matte`
   - Deploy and monitor

5. **BUILD: Pour App Shell**
   - Copy app structure from Matte
   - Remove painting-specific features
   - Test authentication and core features

6. **MIGRATE: Database Schema**
   - Create and test migration locally
   - Deploy to staging
   - Deploy to production

7. **DOCUMENT: Create Guides**
   - Write developer documentation
   - Create deployment procedures
   - Team training materials

---

## 🔄 Rollback Plan

If issues arise and you need to revert:

1. **Restore from Git**
   ```bash
   git checkout claude/core-product-split-2cNPH~1  # Go to commit before split
   git checkout -b rollback/pre-split
   ```

2. **Keep Monorepo, Revert Imports**
   - Keep the monorepo structure (it's valuable)
   - Temporarily move `packages/core/src/*` back to `apps/matte/src/lib/`
   - Update imports back to local paths
   - Build and deploy Matte
   - Resume split work later

3. **Emergency Hotfix Process**
   - Make fix in `apps/matte` directly
   - Deploy immediately
   - Backport to `packages/core` when ready

---

## 💡 Lessons Learned

### What Went Well
1. **Clear Architecture** - The ARCHITECTURE.md document provides excellent guidance
2. **Automated Migration** - Using sed for bulk import updates saved hours
3. **Incremental Approach** - Moving files first, then fixing imports worked well
4. **Type Safety** - TypeScript caught many issues early

### Challenges Faced
1. **Next.js Server/Client Boundary** - More complex than anticipated in monorepo
2. **Import Resolution** - Needed explicit subpath exports in package.json
3. **Build Tool Complexity** - Next.js with Turbopack has specific requirements

### Recommendations for Future Products
1. **Start with Proper Imports** - Use subpath imports from day one
2. **Separate Client/Server Early** - Don't mix in same files
3. **Test Build Frequently** - Don't wait until full migration to test
4. **Use Server Actions** - Reduce client-side database access

---

## 📞 Support Contacts

### Codebase Ownership
- **Core Package**: [Team Lead]
- **Matte App**: [Matte Team]
- **Pour App**: [Pour Team] (TBD)
- **Database**: [Backend Team]

### Escalation Path
1. Check this document first
2. Review `ARCHITECTURE.md`
3. Search closed GitHub issues
4. Create new issue with label: `monorepo`
5. Tag `@engineering` in Slack

---

## 📚 References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete architectural design
- [npm Workspaces Docs](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

---

**Last Updated:** 2026-01-16
**Next Review:** After Matte deployment succeeds
