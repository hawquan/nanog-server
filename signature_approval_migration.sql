-- Signature Approval Migration
-- This migration adds signature approval functionality to the refund request system
-- Date: 2024-12-19

-- =====================================================
-- 1. ADD SIGNATURE APPROVAL FIELDS TO REFUND REQUESTS TABLE
-- =====================================================

-- Add signature approval tracking fields
ALTER TABLE nano_refund_requests 
ADD COLUMN IF NOT EXISTS leader_signature_approved VARCHAR(255), -- Firebase UID of Sales Executive leader who approved signature
ADD COLUMN IF NOT EXISTS leader_signature_approved_date TIMESTAMP;

-- Add comments to document the new columns
COMMENT ON COLUMN nano_refund_requests.leader_signature_approved IS 'UID of the Sales Executive leader who approved the customer signature';
COMMENT ON COLUMN nano_refund_requests.leader_signature_approved_date IS 'Timestamp when Sales Executive leader approved the customer signature';

-- =====================================================
-- 2. UPDATE EXISTING RECORDS
-- =====================================================

-- Update any existing records that are in 'sales_coordinator_pending' status
-- to 'leader_signature_approval_pending' if they have a signature but no leader signature approval
UPDATE nano_refund_requests 
SET status = 'leader_signature_approval_pending',
    current_approver_role = 'leader'
WHERE status = 'sales_coordinator_pending' 
  AND customer_signature_url IS NOT NULL 
  AND leader_signature_approved IS NULL;

-- =====================================================
-- 3. VERIFICATION QUERIES
-- =====================================================

-- Verify the new fields were added
SELECT 
    'Signature approval fields verification' as info,
    COUNT(*) as total_refund_requests,
    COUNT(CASE WHEN leader_signature_approved IS NOT NULL THEN 1 END) as leader_signature_approved_count,
    COUNT(CASE WHEN status = 'leader_signature_approval_pending' THEN 1 END) as leader_signature_approval_pending_count,
    COUNT(CASE WHEN status = 'sales_coordinator_pending' THEN 1 END) as sales_coordinator_pending_count
FROM nano_refund_requests;

-- Show summary of signature approval status
SELECT 
    'Signature approval status summary' as info,
    status,
    COUNT(*) as count
FROM nano_refund_requests 
WHERE status IN ('leader_signature_approval_pending', 'sales_coordinator_pending', 'pending_signature')
GROUP BY status
ORDER BY status;

-- =====================================================
-- 4. MIGRATION COMPLETION
-- =====================================================

SELECT 'Signature approval migration finished successfully!' as migration_status;
