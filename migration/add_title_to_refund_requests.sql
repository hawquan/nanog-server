-- Add title column to refund requests table
-- Date: 2024-01-31

ALTER TABLE nano_refund_requests
ADD COLUMN title VARCHAR(255);

-- Add comment to explain the column
COMMENT ON COLUMN nano_refund_requests.title IS 'Title/subject of the refund request';