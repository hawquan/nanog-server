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
    console.log('Starting refund titles table migration...');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(__dirname + '/../migration/create_refund_titles_table.sql', 'utf8');
    
    // Run migration
    await pool.query(migrationSQL);
    
    // Verify the table was created
    const verifyResult = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'nano_refund_titles'
      ORDER BY ordinal_position;
    `);

    if (verifyResult.rows.length > 0) {
      console.log('\nTable verification:');
      console.log(JSON.stringify(verifyResult.rows, null, 2));
      
      // Verify initial data
      const dataResult = await pool.query('SELECT * FROM nano_refund_titles;');
      console.log('\nInitial data verification:');
      console.log(JSON.stringify(dataResult.rows, null, 2));
      
      console.log('\nMigration completed successfully! 🎉');
    } else {
      console.log('\nWarning: Refund titles table was not found after migration!');
    }
    
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
