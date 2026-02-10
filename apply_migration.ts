import { pool } from "./server/db.js";

async function runMigration() {
  console.log("Running manual migration...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "program_tasks" (
        "id" serial PRIMARY KEY NOT NULL,
        "description" varchar(255) NOT NULL,
        "status" varchar(20) DEFAULT 'pending' NOT NULL,
        "metadata_file_id" varchar,
        "series_title" text,
        "season" integer,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // Foreign keys
    try {
      await client.query(`
        ALTER TABLE "program_tasks" 
        ADD CONSTRAINT "program_tasks_metadata_file_id_metadata_files_id_fk" 
        FOREIGN KEY ("metadata_file_id") REFERENCES "metadata_files"("id") 
        ON DELETE cascade;
      `);
    } catch (e: any) {
      // Ignore if constraint exists
      if (e.code !== '42710') console.log("Note: FK metadata_file_id might already exist or failed:", e.message);
    }

    try {
      await client.query(`
        ALTER TABLE "program_tasks" 
        ADD CONSTRAINT "program_tasks_created_by_users_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id") 
        ON DELETE no action;
      `);
    } catch (e: any) {
       // Ignore if constraint exists
       if (e.code !== '42710') console.log("Note: FK created_by might already exist or failed:", e.message);
    }

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_program_tasks_metadata_file_id" ON "program_tasks" ("metadata_file_id");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_program_tasks_series_season" ON "program_tasks" ("series_title", "season");`);

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
