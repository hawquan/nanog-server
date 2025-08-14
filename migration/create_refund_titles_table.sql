-- Create Refund Titles Table
-- Date: 2024-03-19

-- Create nano_refund_titles table to store predefined titles
CREATE TABLE IF NOT EXISTS nano_refund_titles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255), -- Firebase UID of creator
    updated_by VARCHAR(255)  -- Firebase UID of last updater
);

-- Add unique constraint on title to prevent duplicates
ALTER TABLE nano_refund_titles ADD CONSTRAINT unique_refund_title UNIQUE (title);

-- Add comment to explain the table
COMMENT ON TABLE nano_refund_titles IS 'Predefined titles/reasons for refund requests';

-- Create trigger to update updated_date
CREATE OR REPLACE FUNCTION update_refund_titles_updated_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_refund_titles_updated_date
    BEFORE UPDATE ON nano_refund_titles
    FOR EACH ROW
    EXECUTE FUNCTION update_refund_titles_updated_date();

-- Import existing titles from refund requests
INSERT INTO nano_refund_titles (title, description, created_by)
SELECT DISTINCT title, 'Imported from existing refund requests' as description, 'system' as created_by
FROM nano_refund_requests
WHERE title IS NOT NULL
ON CONFLICT (title) DO NOTHING;

-- Add some initial common titles
INSERT INTO nano_refund_titles (title, description, created_by) VALUES
('Change of Mind', 'Customer changed their mind about the purchase', 'system'),
('Product Defect', 'Product has manufacturing defects or quality issues', 'system'),
('Service Unsatisfactory', 'Customer unsatisfied with service quality', 'system'),
('Wrong Product', 'Incorrect product was delivered or installed', 'system'),
('Duplicate Payment', 'Customer was charged multiple times', 'system');

-- Drop the existing foreign key constraint if it exists
ALTER TABLE nano_refund_requests
DROP CONSTRAINT IF EXISTS fk_refund_title;

-- Note: Titles in refund requests are now free text and not constrained to predefined list
