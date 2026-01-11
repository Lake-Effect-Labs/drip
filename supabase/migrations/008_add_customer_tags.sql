-- Customer tags feature
CREATE TABLE customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES user_profiles(id)
);

CREATE INDEX idx_customer_tags_customer ON customer_tags(customer_id);
CREATE INDEX idx_customer_tags_company ON customer_tags(company_id);
CREATE UNIQUE INDEX idx_customer_tags_unique ON customer_tags(customer_id, tag);

COMMENT ON TABLE customer_tags IS 'Predefined tags for customer segmentation (good_payer, repeat_customer, referral, vip, needs_followup)';
