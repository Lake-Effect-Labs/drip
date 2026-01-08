# Drip-lite Production Readiness Checklist

**Go/No-Go Gate** - If an item is ❌, it blocks launch.

---

## 🧱 1. CORE PRODUCT READINESS (MUST PASS)

### Job & Board
- [ ] Job board loads in <2s on first load
- [ ] Drag-and-drop between stages works reliably
- [ ] Job state updates persist after refresh
- [ ] No job can exist without a customer
- [ ] No job can be "lost" due to invalid state

### Estimates
- [ ] Estimate can be created in <60 seconds
- [ ] Square-footage pricing calculation is deterministic
- [ ] Public estimate link loads without auth
- [ ] Accepting an estimate updates job status correctly
- [ ] Expired / invalid estimate links fail gracefully

### Copy-to-Text
- [ ] Copy buttons work on desktop + mobile
- [ ] Copied text contains: customer name, job address, correct link
- [ ] No placeholder text leaks ("TODO", "example", etc.)

---

## 🔐 2. AUTH, MULTI-TENANCY, & SECURITY (NON-NEGOTIABLE)

### Auth
- [ ] Sign up / login works on clean browser
- [ ] Password reset works end-to-end
- [ ] Session persists across refresh
- [ ] Logout fully clears session

### Multi-Tenant Isolation
- [ ] User cannot access another company's data (manual test)
- [ ] RLS policies enforced on: jobs, customers, estimates, invoices
- [ ] Service role key never exposed client-side

### Public Pages
- [ ] Public estimate/invoice pages expose ONLY required data
- [ ] Public pages cannot enumerate other records
- [ ] Invalid tokens return 404, not data

---

## 💳 3. PAYMENTS & BILLING (IF ENABLED)

### Stripe
- [ ] Stripe test payment succeeds
- [ ] Stripe webhook events processed idempotently
- [ ] Duplicate webhook events do NOT double-record payments
- [ ] Failed payment does NOT break job state
- [ ] Manual payment marking works without Stripe

### Pricing Enforcement
- [ ] Free users cannot exceed allowed limits
- [ ] Paid users unlock features immediately after checkout
- [ ] Cancelled subscriptions downgrade correctly
- [ ] No "ghost paid" state exists

---

## 🧪 4. DATA INTEGRITY & EDGE CASES

- [ ] Deleting a customer handles associated jobs safely
- [ ] Deleting a customer does not orphan data
- [ ] Deleting a job does not break board state
- [ ] Refresh during drag/drop does not corrupt data
- [ ] Empty states render cleanly (no blank screens)
- [ ] Demo data cannot leak into production tenants

---

## 📦 5. DEPLOYMENT & ENVIRONMENT SAFETY

### Environments
- [ ] Local, staging, and production are isolated
- [ ] Production DB cannot be modified from local scripts
- [ ] .env values validated at startup
- [ ] App fails fast if critical env vars missing

### Builds
- [ ] `npm run build` passes cleanly
- [ ] No TypeScript errors suppressed
- [ ] No console errors in production
- [ ] Source maps not publicly exposed (unless intentional)

---

## 🚨 6. ERROR HANDLING & OBSERVABILITY (MINIMUM VIABLE)

- [ ] User-facing errors are human-readable
- [ ] API errors return safe messages (no stack traces)
- [ ] Unexpected errors are logged server-side
- [ ] Stripe webhook failures are logged
- [ ] Auth failures are logged

---

## 🧠 7. UX & PRODUCT CLARITY (CRITICAL FOR COLD EMAIL)

- [ ] First screen after login shows value immediately
- [ ] User can create first job without tutorial
- [ ] No modal explains "how the app works"
- [ ] Navigation labels match painter language
- [ ] No internal/dev terms visible ("entity", "record", etc.)

**If a painter asks "what do I click first?", you failed.**

---

## 🔥 8. ABUSE & FAILURE MODES

- [ ] Rate limits on public endpoints
- [ ] Token guessing impossible
- [ ] SQL injection impossible via Supabase client
- [ ] Massive CSV export cannot crash app
- [ ] Bad input does not crash pages

---

## 📄 9. LEGAL & BASIC COMPLIANCE (LIGHTWEIGHT)

- [ ] Privacy policy exists (even basic)
- [ ] Terms of service exists
- [ ] No PII stored unnecessarily
- [ ] Stripe receipts handled by Stripe
- [ ] Contact email present

---

## 🚀 10. LAUNCH READINESS (FINAL GATE)

- [ ] Can onboard a brand-new painter in <5 minutes
- [ ] Can create job → estimate → accept → invoice → paid
- [ ] Can explain product in one sentence
- [ ] Can safely send cold traffic to signup
- [ ] You are comfortable charging $49/mo

**If you hesitate on the last one — don't ship yet.**

---

## 🧠 OPTIONAL: DRIP-LITE VS DRIP-PRO FLAGS (FOR LATER)

- [ ] Which features are Lite (documented in DRIP_LITE.md)
- [ ] Which are Pro (hidden but not deleted)
- [ ] Which are hidden (routes exist but not in nav)
