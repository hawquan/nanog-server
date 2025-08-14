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
    console.log('Starting title column migration...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(__dirname + '/../add_title_to_refund_requests.sql', 'utf8');
    
    // Run migration
    await pool.query(migrationSQL);
    
    // Verify the column was added
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, col_description(
        (SELECT oid FROM pg_class WHERE relname = 'nano_refund_requests'),
        ordinal_position
      ) as column_comment
      FROM information_schema.columns 
      WHERE table_name = 'nano_refund_requests' AND column_name = 'title';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('\nColumn verification:');
      console.log(JSON.stringify(verifyResult.rows[0], null, 2));
      console.log('\nMigration completed successfully! 🎉');
    } else {
      console.log('\nWarning: Title column was not found after migration!');
    }
    
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
