-- Add guarantor fields to loans table
ALTER TABLE loans ADD COLUMN guarantor_name TEXT;
ALTER TABLE loans ADD COLUMN guarantor_phone TEXT;
ALTER TABLE loans ADD COLUMN guarantor_address TEXT; 