-- Add status field to loans table
ALTER TABLE loans ADD COLUMN status TEXT DEFAULT 'active' NOT NULL;

-- Update existing loans to have 'active' status
UPDATE loans SET status = 'active' WHERE status IS NULL; 