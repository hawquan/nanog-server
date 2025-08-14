const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nanog',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function cleanupRefundRequest(leadId) {
  try {
    console.log(`Starting cleanup for lead_id: ${leadId}`);
    
    // First, check if refund request exists
    const checkRequest = await pool.query(
      `SELECT id, status FROM nano_refund_requests WHERE lead_id = $1`,
      [leadId]
    );
    
    if (checkRequest.rows.length === 0) {
      console.log(`No refund request found for lead_id: ${leadId}`);
      return;
    }
    
    console.log(`Found ${checkRequest.rows.length} refund request(s) for lead_id: ${leadId}`);
    checkRequest.rows.forEach((row, index) => {
      console.log(`  Request ${index + 1}: ID=${row.id}, Status=${row.status}`);
    });
    
    // Delete refund request(s)
    const deleteResult = await pool.query(
      `DELETE FROM nano_refund_requests WHERE lead_id = $1 RETURNING id`,
      [leadId]
    );
    
    console.log(`Deleted ${deleteResult.rows.length} refund request(s)`);
    
    // Reset lead status to allow new refund requests
    const updateResult = await pool.query(
      `UPDATE nano_leads SET refund_status = NULL WHERE id = $1 RETURNING id`,
      [leadId]
    );
    
    if (updateResult.rows.length > 0) {
      console.log(`Reset refund_status for lead_id: ${leadId}`);
    } else {
      console.log(`Lead with id ${leadId} not found`);
    }
    
    console.log(`Cleanup completed successfully for lead_id: ${leadId}`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

async function cleanupAllRefundRequests() {
  try {
    console.log('Starting cleanup for ALL refund requests...');
    
    // First, check how many refund requests exist
    const checkAllRequests = await pool.query(
      `SELECT COUNT(*) as total FROM nano_refund_requests`
    );
    
    const totalRequests = parseInt(checkAllRequests.rows[0].total);
    console.log(`Found ${totalRequests} total refund request(s)`);
    
    if (totalRequests === 0) {
      console.log('No refund requests to clean up');
      return;
    }
    
    // Show details of all refund requests before deletion
    const allRequests = await pool.query(
      `SELECT id, lead_id, status, customer_name, created_date FROM nano_refund_requests ORDER BY id`
    );
    
    console.log('\nRefund requests to be deleted:');
    allRequests.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ID=${row.id}, Lead=${row.lead_id}, Status=${row.status}, Customer=${row.customer_name}, Created=${row.created_date}`);
    });
    
    // Delete ALL refund requests
    const deleteResult = await pool.query(
      `DELETE FROM nano_refund_requests RETURNING id, lead_id`
    );
    
    console.log(`\nDeleted ${deleteResult.rows.length} refund request(s)`);
    
    // Reset ALL lead refund statuses to 'none'
    const updateResult = await pool.query(
      `UPDATE nano_leads SET refund_status = 'none' WHERE refund_status IS NOT NULL AND refund_status != 'none' RETURNING id`
    );
    
    console.log(`Reset refund_status for ${updateResult.rows.length} lead(s)`);
    
    console.log('\n✅ All refund requests cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Get lead_id from command line argument
const leadId = process.argv[2];

if (!leadId) {
  console.log('Usage: node cleanup_refund.js <lead_id>');
  console.log('Example: node cleanup_refund.js 10588');
  console.log('\nTo clear ALL refund requests, use:');
  console.log('node cleanup_refund.js ALL');
  process.exit(1);
}

if (leadId.toUpperCase() === 'ALL') {
  cleanupAllRefundRequests().finally(() => pool.end());
} else {
  cleanupRefundRequest(leadId).finally(() => pool.end());
} 