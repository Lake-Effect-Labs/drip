-- Proactive nudges feature
CREATE TABLE nudge_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  nudge_type VARCHAR(50) NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_nudge_dismissals_user ON nudge_dismissals(user_id, nudge_type);

COMMENT ON TABLE nudge_dismissals IS 'Track when users dismiss nudge banners (accepted_no_invoice, overdue_invoices, stuck_jobs)';
