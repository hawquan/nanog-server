-- Add area_measurement column to nano_sales_package table
ALTER TABLE nano_sales_package
ADD COLUMN IF NOT EXISTS area_measurement NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS measurement_added_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS measurement_added_by VARCHAR(255);
