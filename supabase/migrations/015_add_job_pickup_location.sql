-- Add pickup location to jobs
ALTER TABLE jobs
ADD COLUMN pickup_location_id UUID REFERENCES pickup_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_jobs_pickup_location ON jobs(pickup_location_id);
