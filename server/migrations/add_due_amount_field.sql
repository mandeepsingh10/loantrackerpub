-- Add dueAmount field to payments table for tracking partial payment balances
ALTER TABLE payments ADD COLUMN due_amount REAL DEFAULT 0;

-- Update existing payments to have dueAmount = 0 (no outstanding balance)
UPDATE payments SET due_amount = 0 WHERE due_amount IS NULL; 