import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDb() {
  console.log("Checking Database Content...");
  const client = await pool.connect();
  try {
    // Check users
    const usersRes = await client.query('SELECT count(*) FROM users');
    console.log(`Users count: ${usersRes.rows[0].count}`);
    
    // Check metadata files
    const filesRes = await client.query('SELECT count(*) FROM metadata_files');
    console.log(`Metadata Files count: ${filesRes.rows[0].count}`);

    // Check program tasks
    const tasksRes = await client.query('SELECT count(*) FROM program_tasks');
    console.log(`Program Tasks count: ${tasksRes.rows[0].count}`);

    // Check recent files (last 24h)
    const recentRes = await client.query("SELECT count(*) FROM metadata_files WHERE created_at >= NOW() - INTERVAL '24 HOURS'");
    console.log(`Recent Files count: ${recentRes.rows[0].count}`);

    // Check series count
    const seriesRes = await client.query("SELECT count(distinct title) FROM metadata_files");
    console.log(`Series count (by title): ${seriesRes.rows[0].count}`);

  } catch (error) {
    console.error("DB Check failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

checkDb();
