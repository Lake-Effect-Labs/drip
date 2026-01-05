# Drip - Painting Company OS

The all-in-one operating system for US residential repaint painting companies. Quotes, scheduling, invoicing, and inventory — all in one place.

## Features

- **Board View**: Jira-style kanban board with fixed stages (New → Quoted → Scheduled → In Progress → Done → Paid → Archive)
- **Calendar**: Drag-and-drop scheduling with month view
- **Estimates**: Square footage-based auto-pricing with customizable rates
- **Invoices**: Stripe-powered online payments + manual payment recording (cash, check, Venmo, etc.)
- **Customers**: Full customer management with job history and contact info
- **Inventory**: Track supplies with low-stock alerts and buy lists
- **Copy-to-Text**: Generate shareable links and pre-written messages for customers
- **Data Export**: CSV exports for invoices, payments, and customers
- **Team Management**: Invite links for team members with expiration and revocation

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Payments**: Stripe Checkout + Webhooks
- **Drag & Drop**: @dnd-kit

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account
- Stripe account (for payments)

### Environment Variables

Create a `.env.local` file with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL (for Stripe redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and keys to `.env.local`

### Demo Data (Optional)

After signing up and creating your first company, you can populate demo data:

1. Sign up for an account in the app
2. Go to Supabase SQL Editor
3. Run the seed file: `supabase/seed.sql`

This creates sample customers, jobs, estimates, invoices, and inventory items.

### Stripe Setup

1. Create a Stripe account (test mode is fine for development)
2. Get your secret key from the Stripe Dashboard
3. For webhooks:
   - Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
   - Login: `stripe login`
   - Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Copy the webhook signing secret to `.env.local`

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup, join)
│   ├── app/               # Authenticated app pages
│   │   ├── board/         # Kanban board
│   │   ├── calendar/      # Calendar view
│   │   ├── customers/     # Customer list & details
│   │   ├── jobs/          # Job details
│   │   ├── estimates/     # Estimate builder & details
│   │   ├── invoices/      # Invoice builder & details
│   │   ├── inventory/     # Inventory management
│   │   └── settings/      # Company settings
│   ├── api/               # API routes
│   │   ├── estimates/     # Estimate acceptance
│   │   ├── invites/       # Invite link handling
│   │   ├── invoices/      # Stripe checkout
│   │   └── webhooks/      # Stripe webhooks
│   ├── e/[token]/         # Public estimate page
│   └── i/[token]/         # Public invoice page
├── components/
│   ├── app/               # App-specific components
│   ├── public/            # Public page components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── supabase/          # Supabase client setup
│   └── utils.ts           # Utility functions
└── types/
    └── database.ts        # TypeScript types for database

supabase/
├── migrations/
│   └── 001_initial_schema.sql  # Database schema with RLS policies
└── seed.sql                    # Demo data for testing
```

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the complete schema.

Key tables:
- `companies` - Multi-tenant company data
- `company_users` - User-company relationships
- `jobs` - Job cards that move through the board
- `estimates` - Estimates with line items
- `invoices` - Invoices with Stripe integration
- `inventory_items` - Supply tracking
- `job_materials` - Per-job material checklists

## Themes

Drip includes 10 Sherwin-Williams inspired themes:
- Agreeable Gray (default)
- Alabaster
- Pure White
- Extra White
- Iron Ore
- Urbane Bronze
- Tricorn Black
- Drift of Mist
- Shoji White
- Accessible Beige

## Workflow

1. **New Job**: Create a job card (starts in "New" column)
2. **Quote**: Create an estimate → job moves to "Quoted"
3. **Customer Accepts**: Customer accepts estimate via public link → job moves to "Scheduled"
4. **Schedule**: Set date/time on job
5. **Work**: Mark job as started → "In Progress"
6. **Complete**: Mark job complete → "Done"
7. **Invoice**: Create and send invoice
8. **Payment**: Customer pays via Stripe → "Paid"

## Copy-to-Text Messages

Every estimate, invoice, and job includes copy-to-clipboard functionality:

**Estimate Messages:**
- Copy Link: Shareable public URL
- Copy Message: Pre-written text with link

**Invoice Messages:**
- Copy Link: Shareable payment URL
- Copy Message: Payment request with link

**Job Messages:**
- Copy Reminder: Appointment reminder with date, time, and address
- Copy Payment Request: Invoice link with amount

Example messages:
> Hey Sarah — just a reminder that we're scheduled for Jan 15, 2026 at 9:00 AM at 123 Oak Street. Reply here if anything changes!

> Here's your payment link for 123 Oak Street: https://... — thank you!

## License

MIT
