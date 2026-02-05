-- Webhook idempotency: track processed Stripe event IDs
-- Prevents duplicate processing when Stripe retries webhooks

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup: remove events older than 30 days to prevent unbounded growth
CREATE INDEX idx_webhook_events_processed_at ON webhook_events (processed_at);
