
// PostgreSQL Database Connection with Connection Pooling
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('⚠️ DATABASE_URL not found. Using in-memory storage.');
}

// Use connection pooling for better performance and low latency
const poolUrl = databaseUrl 
  ? databaseUrl.replace('.us-east-2', '-pooler.us-east-2')
  : null;

export const pool = poolUrl ? new Pool({
  connectionString: poolUrl,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}) : null;

// Initialize database tables
export async function initializeDatabase() {
  if (!pool) {
    console.log('📦 Using in-memory storage (no PostgreSQL configured)');
    return;
  }

  try {
    const client = await pool.connect();
    
    try {
      console.log('🗄️ Initializing PostgreSQL database...');
      
      // Create panels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS panels (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          panel_number INTEGER NOT NULL UNIQUE,
          location TEXT NOT NULL,
          install_date TIMESTAMP NOT NULL DEFAULT NOW(),
          health_score REAL NOT NULL DEFAULT 100,
          status TEXT NOT NULL DEFAULT 'active',
          last_maintenance TIMESTAMP,
          notes TEXT
        );
      `);

      // Create sensor_readings table with indexes for fast queries
      await client.query(`
        CREATE TABLE IF NOT EXISTS sensor_readings (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          panel_id VARCHAR NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          energy_output REAL NOT NULL,
          sunlight_intensity REAL NOT NULL,
          temperature REAL NOT NULL,
          dust_level REAL NOT NULL,
          tilt_angle REAL NOT NULL,
          efficiency_percent REAL NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_panel_id 
        ON sensor_readings(panel_id);
        
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp 
        ON sensor_readings(timestamp DESC);
      `);

      // Create recommendations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS recommendations (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          panel_id VARCHAR,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          type TEXT NOT NULL,
          urgency TEXT NOT NULL,
          impact_score REAL NOT NULL,
          ai_explanation TEXT NOT NULL,
          implemented BOOLEAN NOT NULL DEFAULT false
        );
      `);

      console.log('✅ PostgreSQL database initialized successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!pool) return false;
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
