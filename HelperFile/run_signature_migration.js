const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nanog',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('Starting signature approval migration...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync('add_title_to_refund_requests.sql', 'utf8');
    
    // Run migration
    const result = await pool.query(migrationSQL);
    
    // Log verification results
    const verificationResults = result.filter(r => r.command === 'SELECT');
    verificationResults.forEach(r => {
      if (r.rows && r.rows.length > 0) {
        console.log('\n=== ' + r.rows[0].info + ' ===');
        r.rows.forEach(row => console.log(JSON.stringify(row, null, 2)));
      }
    });

    console.log('\nMigration completed successfully! 🎉');
    
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
