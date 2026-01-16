# Vercel Monorepo Deployment Guide

This guide explains how to deploy the Drip monorepo to Vercel with separate projects for Matte and Pour.

---

## Overview

**Current Setup:** Single Vercel project pointing to the repo root

**Target Setup:** Two separate Vercel projects, both pointing to the same GitHub repo but with different root directories

- **Project 1 (Matte):** `apps/matte` - Painting product
- **Project 2 (Pour):** `apps/pour` - Concrete product

---

## Why Separate Projects?

1. **Independent Deployments** - Changes to Matte don't deploy Pour (and vice versa)
2. **Environment Isolation** - Each product has its own environment variables
3. **Domain Management** - Each product can have its own domain
4. **Resource Allocation** - Separate billing and resource limits

---

## Step 1: Prepare Your Current Vercel Setup

### Remove Existing Project (Optional)

If you have an existing Vercel project pointing to the repo root, you have two options:

**Option A: Keep and Reconfigure (Recommended)**
1. Go to your existing Vercel project
2. Settings → General → Root Directory
3. Change from `.` to `apps/matte`
4. Save changes

**Option B: Delete and Recreate**
1. Go to Settings → General → scroll to bottom
2. Click "Delete Project"
3. Continue with Step 2 below

---

## Step 2: Create Matte Vercel Project

### 2.1 Create New Project

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Click "Add New..." → "Project"
3. Select your GitHub repo: `Lake-Effect-Labs/drip`
4. Click "Import"

### 2.2 Configure Matte Project

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:**
```
apps/matte
```
⚠️ **CRITICAL:** Must be `apps/matte`, not `.` or `./apps/matte`

**Build Command:**
```bash
cd ../.. && npm install && npm run build --workspace=apps/matte
```

**Install Command:**
```bash
npm install
```

**Output Directory:**
```
.next
```
(Leave as default)

**Node Version:**
```
20.x
```

### 2.3 Set Environment Variables

Add these environment variables in the Vercel dashboard:

**Required (Core):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://matte.yourdomain.com
STRIPE_SECRET_KEY=sk_live_your-stripe-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

**Matte-Specific:**
```bash
WEATHER_API_KEY=your-openweathermap-key
OPENAI_API_KEY=sk-your-openai-key
```

**Important:** Set these for **Production**, **Preview**, and **Development** environments

### 2.4 Configure Deployment Settings

**Production Branch:**
```
main
```

**Deployment Protection:**
- Enable "Vercel Authentication" if you want password-protected previews

**Ignored Build Step:** Leave blank (deploy on every push to main)

### 2.5 Project Settings

**Project Name:**
```
matte
```
(or `drip-matte` if "matte" is taken)

**Domains:**
Add your custom domain:
- `matte.yourdomain.com` (production)
- `matte-staging.yourdomain.com` (optional staging)

---

## Step 3: Create Pour Vercel Project

### 3.1 Create Second Project

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Click "Add New..." → "Project"
3. Select the **same GitHub repo**: `Lake-Effect-Labs/drip`
4. Click "Import"

**Yes, you're importing the same repo twice. This is correct for monorepos.**

### 3.2 Configure Pour Project

**Framework Preset:** Next.js

**Root Directory:**
```
apps/pour
```

**Build Command:**
```bash
cd ../.. && npm install && npm run build --workspace=apps/pour
```

**Install Command:**
```bash
npm install
```

**Output Directory:** `.next`

**Node Version:** `20.x`

### 3.3 Set Environment Variables

Add these environment variables:

**Required (Core):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://pour.yourdomain.com
STRIPE_SECRET_KEY=sk_live_your-stripe-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

**⚠️ Do NOT add these (Matte-specific):**
- ❌ `WEATHER_API_KEY`
- ❌ `OPENAI_API_KEY`

### 3.4 Configure Deployment Settings

**Production Branch:** `main`

**Project Name:** `pour` (or `drip-pour`)

**Domains:** `pour.yourdomain.com`

---

## Step 4: Verify Deployment Behavior

### Test Case 1: Change Matte UI

1. Make a change to `apps/matte/src/app/page.tsx`
2. Commit and push to `main`
3. **Expected:**
   - ✅ Matte project deploys
   - ❌ Pour project does NOT deploy

### Test Case 2: Change Pour UI

1. Make a change to `apps/pour/src/app/page.tsx`
2. Commit and push to `main`
3. **Expected:**
   - ❌ Matte project does NOT deploy
   - ✅ Pour project deploys

### Test Case 3: Change Core Logic

1. Make a change to `packages/core/src/utils/index.ts`
2. Commit and push to `main`
3. **Expected:**
   - ✅ Matte project deploys
   - ✅ Pour project deploys

**Why?** Vercel detects changes in `packages/core` affect both apps because they import from it.

### Test Case 4: Change Root Files

1. Make a change to `package.json` (root)
2. Commit and push to `main`
3. **Expected:**
   - ✅ Both projects deploy

---

## Step 5: Configure Ignored Build Step (Optional)

To prevent unnecessary deploys, you can add an "Ignored Build Step" command that checks if files changed.

### For Matte Project

Go to Settings → Git → Ignored Build Step:

```bash
bash -c '[[ -n $(git diff HEAD^ HEAD -- apps/matte packages/core package.json) ]] && exit 1 || exit 0'
```

This only deploys if:
- `apps/matte/` changed
- `packages/core/` changed
- Root `package.json` changed

### For Pour Project

```bash
bash -c '[[ -n $(git diff HEAD^ HEAD -- apps/pour packages/core package.json) ]] && exit 1 || exit 0'
```

**Note:** Vercel's default behavior is pretty smart, so this is optional.

---

## Step 6: Update GitHub Repository Settings (Optional)

### Branch Protection

If you want to enforce checks before merging to `main`:

1. Go to GitHub repo → Settings → Branches
2. Add rule for `main`:
   - Require pull request reviews
   - Require status checks to pass:
     - ✅ `vercel/matte (deployment)`
     - ✅ `vercel/pour (deployment)`

---

## Architecture Diagram

```
GitHub Repo: Lake-Effect-Labs/drip
│
├── packages/core/           ← Shared logic
├── apps/matte/              ← Matte app
└── apps/pour/               ← Pour app

Push to main
│
├─→ Vercel Project: "matte"
│   ├── Root Directory: apps/matte
│   ├── Builds when: apps/matte/* or packages/core/* changes
│   ├── Domain: matte.yourdomain.com
│   └── Env: WEATHER_API_KEY, OPENAI_API_KEY (Matte-specific)
│
└─→ Vercel Project: "pour"
    ├── Root Directory: apps/pour
    ├── Builds when: apps/pour/* or packages/core/* changes
    ├── Domain: pour.yourdomain.com
    └── Env: No Matte-specific vars
```

---

## Troubleshooting

### Problem: Both projects deploy on every commit

**Solution:** Add "Ignored Build Step" (Step 5 above)

### Problem: Build fails with "cannot find module @drip/core"

**Solution:**
1. Check Root Directory is set correctly (`apps/matte` not `matte`)
2. Build command includes `cd ../.. && npm install`
3. Workspace is defined in root `package.json`

### Problem: Environment variables not working

**Solution:**
1. Verify variables are set in Vercel dashboard
2. Check they're set for correct environment (Production/Preview/Development)
3. Redeploy after adding variables

### Problem: 404 on production domain

**Solution:**
1. Check domain is correctly configured in Vercel
2. Verify DNS records point to Vercel:
   - Type: `CNAME`
   - Value: `cname.vercel-dns.com`
3. Wait for DNS propagation (up to 48 hours)

### Problem: Build works locally but fails on Vercel

**Solution:**
1. Check Node version matches (`20.x`)
2. Verify all environment variables are set
3. Check build logs for specific error
4. Ensure `packages/core` has all dependencies in its `package.json`

---

## Migration from Single Project

If you currently have a single Vercel project:

### Option 1: Keep Existing, Add Pour (Recommended)

1. **Reconfigure Existing Project:**
   - Settings → General → Root Directory → Change to `apps/matte`
   - Update build command
   - Rename project to "matte" if needed

2. **Create New Project for Pour:**
   - Follow Step 3 above

### Option 2: Fresh Start

1. **Delete Existing Project:**
   - Settings → General → Delete Project

2. **Create Both Projects:**
   - Follow Steps 2 and 3 above

---

## CI/CD Integration (Optional)

### GitHub Actions

You can add additional CI checks:

**.github/workflows/test.yml:**
```yaml
name: Test

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test-matte:
    if: contains(github.event.head_commit.modified, 'apps/matte') || contains(github.event.head_commit.modified, 'packages/core')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build --workspace=apps/matte

  test-pour:
    if: contains(github.event.head_commit.modified, 'apps/pour') || contains(github.event.head_commit.modified, 'packages/core')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build --workspace=apps/pour
```

---

## Maintenance

### Adding a New Product (e.g., "Tile")

1. Create `apps/tile` directory
2. Set up Next.js app
3. Import from `@drip/core`
4. Create new Vercel project:
   - Root Directory: `apps/tile`
   - Build command: `cd ../.. && npm install && npm run build --workspace=apps/tile`
   - Add environment variables
   - Configure domain

### Updating Core Package

When you update `packages/core`:
- Both Matte and Pour will automatically rebuild
- Test changes in both products before merging

### Managing Secrets

- Never commit `.env` files
- Use Vercel environment variables for all secrets
- Rotate keys regularly (Stripe, Supabase, OpenAI)
- Use different keys for staging/production

---

## Quick Reference

### Matte Project Settings
```
Name: matte
Repo: Lake-Effect-Labs/drip
Root: apps/matte
Branch: main
Build: cd ../.. && npm install && npm run build --workspace=apps/matte
Domain: matte.yourdomain.com
Env: Core + WEATHER_API_KEY + OPENAI_API_KEY
```

### Pour Project Settings
```
Name: pour
Repo: Lake-Effect-Labs/drip
Root: apps/pour
Branch: main
Build: cd ../.. && npm install && npm run build --workspace=apps/pour
Domain: pour.yourdomain.com
Env: Core only (no Matte-specific vars)
```

---

## Support

If you encounter issues:

1. Check [Vercel Documentation](https://vercel.com/docs/concepts/monorepos)
2. Review [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
3. Check Vercel build logs for specific errors
4. Verify environment variables are set correctly

---

## Checklist

Before going live:

- [ ] Matte project created with correct root directory
- [ ] Pour project created with correct root directory
- [ ] All environment variables set for both projects
- [ ] Production domains configured and DNS updated
- [ ] Test deployment with each project
- [ ] Verify independent deployments work correctly
- [ ] Check that core changes trigger both deploys
- [ ] Set up branch protection rules (optional)
- [ ] Configure ignored build steps (optional)
- [ ] Test production URLs are accessible

---

**Last Updated:** 2026-01-16
**Version:** 1.0

For questions or issues, refer to `ARCHITECTURE.md` and `IMPLEMENTATION_STATUS.md`.
