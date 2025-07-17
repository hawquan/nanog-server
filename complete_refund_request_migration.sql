-- Complete Refund Request System Migration
-- This migration includes all changes for the refund request system
-- Date: 2024-12-19

-- =====================================================
-- 1. CREATE REFUND REQUESTS TABLE
-- =====================================================

-- Create nano_refund_requests table
CREATE TABLE IF NOT EXISTS nano_refund_requests (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES nano_leads(id),
    sale_id INTEGER REFERENCES nano_sales(id),
    consultant_id VARCHAR(255), -- Firebase UID of consultant who initiated
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    refund_amount DECIMAL(10,2),
    refund_reason TEXT,
    customer_signature_url VARCHAR(500),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending_signature', -- leader_pending, pending_signature, sales_coordinator_pending, project_admin_pending, nanog_admin_pending, financial_pending, accounts_pending, completed, rejected
    current_approver_role VARCHAR(50), -- leader, customer, sales_coordinator, project_admin, nanog_admin, financial, accounts
    
    -- Approval tracking
    leader_approved VARCHAR(255), -- Firebase UID of Sales Executive leader
    leader_approved_date TIMESTAMP,
    sales_coordinator_approved VARCHAR(255), -- Firebase UID
    sales_coordinator_approved_date TIMESTAMP,
    project_admin_approved VARCHAR(255), -- Firebase UID from sub_company table
    project_admin_approved_date TIMESTAMP,
    nanog_admin_approved VARCHAR(255), -- Firebase UID
    nanog_admin_approved_date TIMESTAMP,
    financial_approved VARCHAR(255), -- Firebase UID
    financial_approved_date TIMESTAMP,
    accounts_approved VARCHAR(255), -- Firebase UID
    accounts_approved_date TIMESTAMP,
    
    -- Rejection tracking
    rejected_by VARCHAR(50),
    rejected_by_user_id VARCHAR(255), -- Firebase UID
    rejection_reason TEXT,
    rejection_date TIMESTAMP,
    
    -- Financial receipt
    receipt_url VARCHAR(500), -- uploaded by financial
    
    -- Timestamps
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_signature_date TIMESTAMP,
    
    -- Additional info
    notes TEXT,
    approval_history JSONB -- store all approval/rejection history
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON nano_refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_consultant_id ON nano_refund_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_lead_id ON nano_refund_requests(lead_id);

-- =====================================================
-- 2. ADD REFUND STATUS TO LEADS TABLE
-- =====================================================

-- Add refund_status column to nano_leads table
ALTER TABLE nano_leads ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'none';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_refund_status ON nano_leads(refund_status);

-- Update existing leads to have 'none' status
UPDATE nano_leads SET refund_status = 'none' WHERE refund_status IS NULL;

-- =====================================================
-- 3. ADD LEADER APPROVAL FUNCTIONALITY
-- =====================================================

-- Ensure is_leader column exists in nano_user table
ALTER TABLE nano_user 
ADD COLUMN IF NOT EXISTS is_leader BOOLEAN DEFAULT false;

-- Add comments to document the columns
COMMENT ON COLUMN nano_refund_requests.leader_approved IS 'UID of the Sales Executive leader who approved the refund request';
COMMENT ON COLUMN nano_refund_requests.leader_approved_date IS 'Timestamp when Sales Executive leader approved the refund request';
COMMENT ON COLUMN nano_refund_requests.sales_coordinator_approved IS 'UID of the Sales Coordinator who approved the refund request';
COMMENT ON COLUMN nano_refund_requests.sales_coordinator_approved_date IS 'Timestamp when Sales Coordinator approved the refund request';
COMMENT ON COLUMN nano_refund_requests.project_admin_approved IS 'UID of the Project Admin from sub_company table who approved the refund request';
COMMENT ON COLUMN nano_refund_requests.project_admin_approved_date IS 'Timestamp when Project Admin approved the refund request';
COMMENT ON COLUMN nano_user.is_leader IS 'Flag indicating if the Sales Executive is a leader who can approve refund requests';

-- =====================================================
-- 4. DATA MIGRATION FOR EXISTING RECORDS
-- =====================================================

-- Update existing refund requests to follow the new leader approval flow
-- Convert any requests in 'pending_signature' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'pending_signature' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- Convert any requests in 'sales_coordinator_pending' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'sales_coordinator_pending' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- Convert any requests in 'project_admin_pending' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'project_admin_pending' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- Convert any requests in 'nanog_admin_pending' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'nanog_admin_pending' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- Convert any requests in 'financial_pending' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'financial_pending' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- Convert any requests in 'accounts_pending' to 'leader_pending' if they were created by non-leaders
UPDATE nano_refund_requests 
SET status = 'leader_pending', 
    current_approver_role = 'leader'
WHERE status = 'accounts_pending' 
  AND consultant_id IN (
    SELECT uid FROM nano_user 
    WHERE (is_leader = false OR is_leader IS NULL) AND user_role = 'Sales Executive'
  );

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Verify the refund requests table structure
SELECT 
    'Refund requests table verification' as info,
    COUNT(*) as total_refund_requests,
    COUNT(CASE WHEN leader_approved IS NOT NULL THEN 1 END) as leader_approved_count,
    COUNT(CASE WHEN sales_coordinator_approved IS NOT NULL THEN 1 END) as sales_coordinator_approved_count,
    COUNT(CASE WHEN project_admin_approved IS NOT NULL THEN 1 END) as project_admin_approved_count,
    COUNT(CASE WHEN status = 'leader_pending' THEN 1 END) as leader_pending_count,
    COUNT(CASE WHEN status = 'pending_signature' THEN 1 END) as pending_signature_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM nano_refund_requests;

-- Show summary of user leader status
SELECT 
    'User leader status summary' as info,
    COUNT(*) as total_sales_executives,
    COUNT(CASE WHEN is_leader = true THEN 1 END) as leader_count,
    COUNT(CASE WHEN is_leader = false OR is_leader IS NULL THEN 1 END) as non_leader_count
FROM nano_user 
WHERE user_role = 'Sales Executive';

-- Verify leads table has refund status
SELECT 
    'Leads refund status verification' as info,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN refund_status = 'none' THEN 1 END) as none_count,
    COUNT(CASE WHEN refund_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN refund_status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN refund_status = 'rejected' THEN 1 END) as rejected_count
FROM nano_leads;

-- =====================================================
-- 6. MIGRATION COMPLETION
-- =====================================================

SELECT 'Complete refund request migration finished successfully!' as migration_status; 