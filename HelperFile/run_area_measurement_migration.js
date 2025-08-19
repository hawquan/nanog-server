const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('Starting area measurement column migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migration/add_area_measurement_column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('Area measurement column migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

runMigration();
