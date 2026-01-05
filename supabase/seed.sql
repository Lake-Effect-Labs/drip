-- Drip - Database Seed Script
-- This script creates demo data for testing and development.
-- Run this AFTER you have created at least one user and company through the app.

-- IMPORTANT: Replace the placeholder values below with your actual IDs
-- You can find these in your Supabase dashboard after signing up.

-- Set your company and user IDs here:
DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_job1_id UUID;
  v_job2_id UUID;
  v_job3_id UUID;
  v_job4_id UUID;
  v_estimate1_id UUID;
  v_estimate2_id UUID;
  v_invoice1_id UUID;
BEGIN
  -- Get the first company and user (adjust if you have multiple)
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  SELECT user_id INTO v_user_id FROM company_users WHERE company_id = v_company_id LIMIT 1;

  IF v_company_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'No company or user found. Please sign up first before running seed.';
  END IF;

  RAISE NOTICE 'Seeding data for company: %', v_company_id;

  -- Create demo customers
  INSERT INTO customers (id, company_id, name, phone, email, address1, city, state, zip, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, 'Sarah Johnson', '(555) 123-4567', 'sarah.johnson@email.com', '123 Oak Street', 'Austin', 'TX', '78701', 'Referred by Mike. Prefers morning appointments.')
  RETURNING id INTO v_customer1_id;

  INSERT INTO customers (id, company_id, name, phone, email, address1, city, state, zip, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, 'Mike Thompson', '(555) 234-5678', 'mike.t@email.com', '456 Maple Ave', 'Austin', 'TX', '78702', 'Has a dog. Gate code: 1234')
  RETURNING id INTO v_customer2_id;

  INSERT INTO customers (id, company_id, name, phone, email, address1, city, state, zip, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, 'Emily Chen', '(555) 345-6789', 'emily.chen@email.com', '789 Pine Road', 'Austin', 'TX', '78703', NULL)
  RETURNING id INTO v_customer3_id;

  -- Create demo jobs
  INSERT INTO jobs (id, company_id, customer_id, title, address1, city, state, zip, status, scheduled_date, scheduled_time, assigned_user_id, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_customer1_id, 'Johnson Interior Repaint', '123 Oak Street', 'Austin', 'TX', '78701', 'scheduled', CURRENT_DATE + INTERVAL '3 days', '09:00', v_user_id, 'Full interior - living room, dining room, 3 bedrooms. Customer prefers SW Agreeable Gray.')
  RETURNING id INTO v_job1_id;

  INSERT INTO jobs (id, company_id, customer_id, title, address1, city, state, zip, status, scheduled_date, scheduled_time, assigned_user_id, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_customer2_id, 'Thompson Kitchen Cabinets', '456 Maple Ave', 'Austin', 'TX', '78702', 'quoted', NULL, NULL, NULL, 'Cabinet refinish - white. Need to sand and prime.')
  RETURNING id INTO v_job2_id;

  INSERT INTO jobs (id, company_id, customer_id, title, address1, city, state, zip, status, scheduled_date, scheduled_time, assigned_user_id, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_customer3_id, 'Chen Master Bedroom', '789 Pine Road', 'Austin', 'TX', '78703', 'new', NULL, NULL, NULL, 'Accent wall in master. Considering dark blue.')
  RETURNING id INTO v_job3_id;

  INSERT INTO jobs (id, company_id, customer_id, title, address1, city, state, zip, status, notes)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_customer1_id, 'Johnson Deck Stain', '123 Oak Street', 'Austin', 'TX', '78701', 'done', 'Completed last week. Great result!')
  RETURNING id INTO v_job4_id;

  -- Create demo estimates
  INSERT INTO estimates (id, company_id, job_id, customer_id, sqft, status, public_token)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_job1_id, v_customer1_id, 2200, 'accepted', 'demo_est_' || substr(md5(random()::text), 1, 16))
  RETURNING id INTO v_estimate1_id;

  INSERT INTO estimates (id, company_id, job_id, customer_id, sqft, status, public_token)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_job2_id, v_customer2_id, NULL, 'sent', 'demo_est_' || substr(md5(random()::text), 1, 16))
  RETURNING id INTO v_estimate2_id;

  -- Create estimate line items
  INSERT INTO estimate_line_items (estimate_id, service_key, service_type, name, description, price, paint_color_name_or_code, sheen, product_line, gallons_estimate)
  VALUES 
    (v_estimate1_id, 'interior_walls', 'sqft', 'Interior Walls', 'Living room, dining room, hallways', 440000, 'SW 7029 Agreeable Gray', 'Eggshell', 'Duration', 8),
    (v_estimate1_id, 'ceilings', 'sqft', 'Ceilings', 'All rooms', 110000, 'SW 7012 Creamy', 'Flat', 'ProMar', 4),
    (v_estimate1_id, 'trim_doors', 'sqft', 'Trim & Doors', 'Baseboards, door frames, crown molding', 165000, 'SW 7006 Extra White', 'Semi-Gloss', 'Emerald', 3);

  INSERT INTO estimate_line_items (estimate_id, service_key, service_type, name, description, price)
  VALUES 
    (v_estimate2_id, 'cabinets', 'flat', 'Kitchen Cabinets', 'Full cabinet refinish - sand, prime, 2 coats', 350000),
    (v_estimate2_id, 'prep_work', 'flat', 'Prep Work', 'Degreasing, sanding, priming', 75000);

  -- Create demo invoice for completed job
  INSERT INTO invoices (id, company_id, job_id, customer_id, status, public_token, amount_total, paid_at)
  VALUES 
    (uuid_generate_v4(), v_company_id, v_job4_id, v_customer1_id, 'paid', 'demo_inv_' || substr(md5(random()::text), 1, 16), 85000, NOW() - INTERVAL '5 days')
  RETURNING id INTO v_invoice1_id;

  -- Create payment record
  INSERT INTO invoice_payments (invoice_id, stripe_payment_intent_id, amount, paid_at)
  VALUES 
    (v_invoice1_id, 'manual_check_' || extract(epoch from now())::text, 85000, NOW() - INTERVAL '5 days');

  -- Create demo inventory items
  INSERT INTO inventory_items (company_id, name, unit, on_hand, reorder_at, cost_per_unit, vendor_name, vendor_sku)
  VALUES 
    (v_company_id, 'Painter''s Tape 2"', 'roll', 12, 5, 8.99, 'Sherwin-Williams', 'SW-TAPE-2'),
    (v_company_id, 'Drop Cloths 9x12', 'each', 6, 3, 15.99, 'Sherwin-Williams', 'SW-DROP-912'),
    (v_company_id, 'Roller Covers 9"', 'pack', 8, 4, 12.99, 'Sherwin-Williams', 'SW-ROLL-9'),
    (v_company_id, 'Angled Brush 2.5"', 'each', 4, 2, 18.99, 'Sherwin-Williams', 'SW-BRUSH-25'),
    (v_company_id, 'Spackle Quart', 'each', 3, 2, 9.99, 'Sherwin-Williams', 'SW-SPACK-QT'),
    (v_company_id, 'Caulk Tubes', 'each', 2, 5, 5.99, 'Sherwin-Williams', 'SW-CAULK'),
    (v_company_id, 'Sandpaper 220 Grit', 'pack', 5, 3, 7.99, 'Sherwin-Williams', 'SW-SAND-220');

  -- Create demo pickup locations
  INSERT INTO pickup_locations (company_id, name, address1, city, state, zip)
  VALUES 
    (v_company_id, 'Sherwin-Williams #1234', '1000 S Congress Ave', 'Austin', 'TX', '78704'),
    (v_company_id, 'Sherwin-Williams #5678', '5500 N Lamar Blvd', 'Austin', 'TX', '78751');

  -- Create job materials for scheduled job
  INSERT INTO job_materials (job_id, name, checked)
  VALUES 
    (v_job1_id, 'Duration Interior Paint - Agreeable Gray (8 gal)', false),
    (v_job1_id, 'ProMar Ceiling Paint - Creamy (4 gal)', false),
    (v_job1_id, 'Emerald Trim Paint - Extra White (3 gal)', false),
    (v_job1_id, 'Painter''s Tape 2"', true),
    (v_job1_id, 'Drop Cloths', true),
    (v_job1_id, 'Roller Covers 9"', false),
    (v_job1_id, 'Angled Brushes', false);

  RAISE NOTICE 'Seed completed successfully!';
  RAISE NOTICE 'Created 3 customers, 4 jobs, 2 estimates, 1 invoice, 7 inventory items';
END $$;

