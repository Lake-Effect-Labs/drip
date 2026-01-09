# Matte

**Track jobs. Send estimates. Get paid.**

A simple job & estimate tracker for painters. No setup. No training.

## What It Does

- **Board View**: See all your jobs at a glance. Drag them from New → Quoted → Scheduled → Done → Paid.
- **Estimates**: Enter square footage, get a price. Send it with one tap.
- **Invoices**: Create an invoice, send the payment link. Done.
- **Copy-to-Text**: Pre-written messages for estimates, reminders, and payment requests. Just paste and send.

## Why Painters Use It

You already use notes, texts, and whiteboards. Drip doesn't change how you work — it just keeps everything in one place so you don't lose jobs.

## Quick Start

### 1. Set Up Supabase

1. Create a [Supabase](https://supabase.com) project
2. Run the schema: `supabase/migrations/001_initial_schema.sql`
3. Copy your keys to `.env.local`

### 2. Set Up Stripe (for payments)

1. Get your Stripe secret key
2. Set up webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. Copy the webhook secret to `.env.local`

### 3. Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run It

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Supabase (database + auth)
- Stripe (payments)

## License

MIT
