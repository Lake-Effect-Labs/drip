-- Drip - Painting Company OS
-- Initial Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles (synced from auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  theme_id TEXT DEFAULT 'agreeable-gray',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company Users (many-to-many but MVP is 1 company per user)
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Invite Links
CREATE TABLE invite_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'scheduled', 'in_progress', 'done', 'paid', 'archive')),
  scheduled_date DATE,
  scheduled_time TIME,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimates
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sqft NUMERIC,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted')),
  accepted_at TIMESTAMPTZ,
  public_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimate Line Items
CREATE TABLE estimate_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('sqft', 'flat')),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- cents
  paint_color_name_or_code TEXT,
  sheen TEXT,
  product_line TEXT,
  gallons_estimate NUMERIC,
  vendor_sku TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  public_token TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT,
  stripe_checkout_url TEXT,
  amount_total INTEGER NOT NULL, -- cents
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Invoice Payments
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- cents
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimating Config (per company)
CREATE TABLE estimating_config (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  walls_rate_per_sqft NUMERIC DEFAULT 2.00,
  ceilings_rate_per_sqft NUMERIC DEFAULT 0.50,
  trim_rate_per_sqft NUMERIC DEFAULT 0.75,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pickup Locations (for Sherwin-Williams stores, etc.)
CREATE TABLE pickup_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'each',
  on_hand INTEGER DEFAULT 0,
  reorder_at INTEGER DEFAULT 0,
  cost_per_unit NUMERIC,
  vendor_name TEXT,
  vendor_sku TEXT,
  preferred_pickup_location_id UUID REFERENCES pickup_locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Materials (checklist per job)
CREATE TABLE job_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN DEFAULT FALSE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  vendor_sku TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_company_users_company_id ON company_users(company_id);
CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_estimates_company_id ON estimates(company_id);
CREATE INDEX idx_estimates_public_token ON estimates(public_token);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_public_token ON invoices(public_token);
CREATE INDEX idx_inventory_items_company_id ON inventory_items(company_id);
CREATE INDEX idx_job_materials_job_id ON job_materials(job_id);
CREATE INDEX idx_invite_links_token ON invite_links(token);

-- Function to get user's company ID
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM company_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to create company with owner
CREATE OR REPLACE FUNCTION create_company_with_owner(
  company_name TEXT,
  owner_id UUID,
  owner_email TEXT,
  owner_name TEXT
)
RETURNS UUID AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create company
  INSERT INTO companies (name, owner_user_id)
  VALUES (company_name, owner_id)
  RETURNING id INTO new_company_id;

  -- Create user profile
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (owner_id, owner_email, owner_name)
  ON CONFLICT (id) DO UPDATE SET full_name = owner_name;

  -- Add user to company
  INSERT INTO company_users (company_id, user_id)
  VALUES (new_company_id, owner_id);

  -- Create default estimating config
  INSERT INTO estimating_config (company_id)
  VALUES (new_company_id);

  RETURN new_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimating_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_materials ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Companies: Users can view their company
CREATE POLICY "Users can view their company" ON companies
  FOR SELECT USING (id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their company" ON companies
  FOR UPDATE USING (id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Company Users: Users can view their own membership and members of their company
CREATE POLICY "Users can view company members" ON company_users
  FOR SELECT USING (
    user_id = auth.uid() OR 
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add members to their company" ON company_users
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can remove members from their company" ON company_users
  FOR DELETE USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Invite Links: Users can manage their company's invite links
CREATE POLICY "Users can view company invite links" ON invite_links
  FOR SELECT USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can create invite links" ON invite_links
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invite links" ON invite_links
  FOR UPDATE USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Customers: Company-scoped access
CREATE POLICY "Users can manage company customers" ON customers
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Jobs: Company-scoped access
CREATE POLICY "Users can manage company jobs" ON jobs
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Estimates: Company-scoped access
CREATE POLICY "Users can manage company estimates" ON estimates
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Estimate Line Items: Access through estimate
CREATE POLICY "Users can manage estimate line items" ON estimate_line_items
  FOR ALL USING (estimate_id IN (
    SELECT id FROM estimates WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

-- Invoices: Company-scoped access
CREATE POLICY "Users can manage company invoices" ON invoices
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Invoice Payments: Access through invoice
CREATE POLICY "Users can view invoice payments" ON invoice_payments
  FOR SELECT USING (invoice_id IN (
    SELECT id FROM invoices WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert invoice payments" ON invoice_payments
  FOR INSERT WITH CHECK (invoice_id IN (
    SELECT id FROM invoices WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

-- Estimating Config: Company-scoped access
CREATE POLICY "Users can manage estimating config" ON estimating_config
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Pickup Locations: Company-scoped access
CREATE POLICY "Users can manage pickup locations" ON pickup_locations
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Inventory Items: Company-scoped access
CREATE POLICY "Users can manage inventory items" ON inventory_items
  FOR ALL USING (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()));

-- Job Materials: Access through job
CREATE POLICY "Users can manage job materials" ON job_materials
  FOR ALL USING (job_id IN (
    SELECT id FROM jobs WHERE company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  ));

