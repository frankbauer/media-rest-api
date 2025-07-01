const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'weaver',
  user: process.env.DB_USER || 'weaver_user',
  password: process.env.DB_PASSWORD || 'weaver_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initDatabase() {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS media_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        bucket VARCHAR(100) NOT NULL,
        object_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        data JSONB
      )
    `);    
    
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_data_records_created_at ON data_records(created_at)`);

    
    client.release();
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initDatabase
};
