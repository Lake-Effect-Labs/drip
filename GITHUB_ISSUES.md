# GitHub Issues for Matte Launch Readiness

## Bugs & Code Issues

### Issue 1: Race condition on affiliate referral/conversion counters
**Labels:** `bug`, `affiliate`

The affiliate system increments `total_referrals` and `total_conversions` counters using a read-then-write pattern with no atomicity:

```typescript
// src/app/api/affiliate/route.ts ~line 101
await supabase.from("creator_codes").update({
  total_referrals: (creatorCode.total_referrals ?? 0) + 1,  // NOT atomic
})

// src/app/api/webhooks/stripe/route.ts ~line 110
await supabase.from("creator_codes").update({
  total_conversions: (creatorCode.total_conversions) + 1,  // NOT atomic
})
```

**Impact:** Concurrent referrals can lose increments. Webhook retries can double-count.

**Fix:** Use a Supabase RPC with `SET total_referrals = total_referrals + 1` for atomic increments.

---

### Issue 2: No idempotency check for Stripe webhook events
**Labels:** `bug`, `billing`

`src/app/api/webhooks/stripe/route.ts` processes every event without checking duplicates. Stripe retries webhooks up to 3 times.

**Impact:** Subscription status overwrites, duplicate commission calculations, inflated counters.

**Fix:** Track processed event IDs in a `webhook_events` table. Check before processing.

---

### Issue 3: Admin-created affiliate codes have 0% commission
**Labels:** `bug`, `affiliate`

`src/app/api/admin/toggle-affiliate/route.ts` line 103 hardcodes `commission_percent: 0`. The webhook calculates `commission_owed = price * 0 / 100 = $0`. Self-created codes via `/api/affiliate/me` correctly default to 20%.

**Impact:** Admin-onboarded affiliates earn $0 commission on conversions.

**Fix:** Set `commission_percent: 20` (or configurable) in the admin toggle endpoint.

---

### Issue 4: New Stripe coupon created per checkout session
**Labels:** `improvement`, `billing`

`src/app/api/billing/checkout/route.ts` line 116 creates a brand new `stripe.coupons.create()` call for every referral checkout. Over time this clutters Stripe with thousands of single-use coupon objects.

**Fix:** Create one reusable coupon or use Stripe Promotion Codes.

---

### Issue 5: Add rate limiting to auth and affiliate endpoints
**Labels:** `security`, `improvement`

No API routes have rate limiting. Login, signup, and affiliate endpoints are vulnerable to brute force and abuse (code enumeration, artificial referral inflation).

**Fix:** Add middleware-level rate limiting (e.g., `next-rate-limit` or Vercel Edge Config rate limiting).

---

## Missing Features - CRITICAL for $25/mo Launch

### Issue 6: PDF estimate/proposal generation
**Labels:** `feature`, `critical`, `estimates`

**Why:** The #1 reason painters buy software. Customers expect professional, branded, itemized PDF proposals they can review, sign, and keep. Currently estimates only exist in the web portal.

**Competitors at this price:** Jobber Core ($28/mo) includes PDF quotes. ServiceM8 ($29/mo) includes PDF invoices.

**What to build:**
- Generate branded PDF from estimate data (company logo, colors, line items, totals)
- Email PDF directly to customer
- Include digital signature acceptance link
- Support Good/Better/Best layout (see Issue 8)

---

### Issue 7: Automated follow-up reminders for unsent/unsigned estimates
**Labels:** `feature`, `critical`, `estimates`

**Why:** The single biggest profit leak cited by painting contractors. Painters send estimates and forget to follow up. DripJobs charges $97/mo largely for their automated follow-up sequences.

**What to build:**
- Auto-reminder when estimate hasn't been viewed/signed after 2, 5, 7 days
- SMS and/or email follow-up using message templates (schema already exists in `message_templates`)
- Simple "follow up now" button on job detail page
- Dashboard indicator for stale estimates

---

### Issue 8: Good/Better/Best tiered proposal options
**Labels:** `feature`, `critical`, `estimates`

**Why:** Painters who offer tiered pricing report 15-30% higher average ticket prices. This is a premium feature that competitors lock behind $59-99/mo tiers.

**What to build:**
- Allow 2-3 pricing tiers per estimate (e.g., "Standard" / "Premium" / "Deluxe")
- Different paint products, coats, or scope per tier
- Customer selects tier when accepting estimate
- Include in PDF proposal (Issue 6)

---

### Issue 9: Time tracking UI
**Labels:** `feature`, `high`, `time-tracking`

**Why:** Schema is fully built (`time_entries` table) and dashboard queries already calculate today/week hours. Just needs the UI.

**What to build:**
- Start/stop timer per job on job detail page
- Manual time entry form
- Weekly timesheet view per team member
- Time summary on dashboard (query already exists in `getDashboardData`)

---

### Issue 10: Inventory management UI
**Labels:** `feature`, `high`, `inventory`

**Why:** Schema is fully built (`inventory_items` table) with reorder levels, vendors, categories. Dashboard already queries for low-inventory alerts.

**What to build:**
- Inventory list page at `/app/inventory`
- Add/edit items with quantity, reorder level, vendor, cost
- Low stock alerts on dashboard (query exists)
- Link to estimate materials (auto-deduct from inventory when job starts)

---

## Missing Features - HIGH Value Differentiators

### Issue 11: QuickBooks Online integration
**Labels:** `feature`, `high`, `integrations`

**Why:** Housecall Pro locks this behind their $149/mo tier. Offering it at $25/mo is a massive differentiator. Every painter with an accountant needs this.

**What to build:**
- Sync customers to QBO
- Sync invoices/payments to QBO
- Map payment methods
- OAuth2 connection flow in settings

---

### Issue 12: Message templates editing UI
**Labels:** `feature`, `medium`

**Why:** 5 default templates are created on company signup (`message_templates` table) but there's no UI to view or edit them. The templates support variables like `{{customer_name}}`, `{{job_date}}`, `{{amount}}`.

**What to build:**
- Templates management page in settings
- Edit template text with variable insertion
- Preview with sample data
- Add custom templates

---

### Issue 13: Job templates UI
**Labels:** `feature`, `medium`

**Why:** Schema exists (`job_templates`, `template_materials`, `template_estimate_items`) but no UI. Painters do the same types of jobs repeatedly (interior repaint, exterior, cabinet refinishing).

**What to build:**
- Create job templates with default description, estimated hours, materials
- "Create from template" option in new job dialog
- Auto-populate estimate line items from template

---

### Issue 14: Affiliate creator dashboard
**Labels:** `feature`, `medium`, `affiliate`

**Why:** `/api/affiliate/me` endpoint returns full stats (code, referrals, conversions, commission) but there's no UI for affiliates to view their performance. They have to ask an admin.

**What to build:**
- Dashboard page at `/app/affiliate` for users with `is_affiliate` flag
- Show referral code, total referrals, conversions, commission earned
- Shareable referral link
- Monthly breakdown chart

---

### Issue 15: Commission payout tracking workflow
**Labels:** `feature`, `medium`, `affiliate`

**Why:** The `referrals` table has `commission_owed`, `commission_paid`, `commission_paid_at` columns but nothing in the codebase ever sets `commission_paid = true`. There's no way to track or process payouts.

**What to build:**
- Admin view of unpaid commissions grouped by affiliate
- Bulk "mark as paid" action
- Payment history per affiliate
- Monthly payout report export

---

### Issue 16: PWA / offline support
**Labels:** `feature`, `medium`

**Why:** Painters work on jobsites with spotty wifi. A PWA with basic offline capability would be a significant differentiator. Currently responsive but no `manifest.json` or service worker.

**What to build:**
- Add `manifest.json` for installability
- Service worker for offline caching of viewed jobs
- Offline queue for updates that sync when back online
- "Add to Home Screen" prompt

---

### Issue 17: SMS sending integration
**Labels:** `feature`, `medium`

**Why:** Message templates exist, SMS links are generated, but actual SMS sending isn't implemented. Currently relies on `sms:` URI scheme which opens the user's phone app. Automated SMS (via Twilio or similar) would enable follow-up automation (Issue 7).

**What to build:**
- Twilio or similar integration
- Send SMS from job detail page
- Automated SMS triggers (estimate sent, job scheduled, job complete)
- SMS delivery status tracking

---

## Test Coverage Improvements

### Issue 18: Add missing affiliate system test cases
**Labels:** `testing`, `affiliate`

Current affiliate tests don't cover:
- Expired referral handling (what happens when referral past `expires_at`?)
- Duplicate visitor_id + same code (concurrent requests)
- Invalid referral code in checkout (silently ignored, should it error?)
- `/api/affiliate/me` endpoint (GET/POST/PUT — zero test coverage)
- Commission calculation accuracy (verify `commission_owed = price * percent / 100`)
- Webhook retry scenario (same event_id processed twice)

---

### Issue 19: Add cross-company authorization tests
**Labels:** `testing`, `security`

Current tests verify 403 for wrong company, but don't test:
- User A trying to access User B's job photos via direct URL
- User accessing estimate materials from another company's estimate
- Company owner deleting a user from a different company
- Session expiration mid-request
- RLS bypass attempts on GET endpoints that only rely on Supabase RLS

---

### Issue 20: Add explicit company verification on RLS-dependent GET endpoints
**Labels:** `security`, `improvement`

Two GET endpoints rely purely on Supabase RLS for authorization without code-level company checks:
- `GET /api/jobs/[id]/photos` (line 8-48)
- `GET /api/estimate-materials/[id]` (line 10-71)

While RLS correctly prevents cross-company access today, defense-in-depth dictates adding explicit `company_id` verification in the route handler as well.
