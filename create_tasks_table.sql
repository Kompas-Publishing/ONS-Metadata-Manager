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

-- Foreign Keys
DO $$ BEGIN
 ALTER TABLE "program_tasks" ADD CONSTRAINT "program_tasks_metadata_file_id_metadata_files_id_fk" FOREIGN KEY ("metadata_file_id") REFERENCES "public"."metadata_files"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "program_tasks" ADD CONSTRAINT "program_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "IDX_program_tasks_metadata_file_id" ON "program_tasks" ("metadata_file_id");
CREATE INDEX IF NOT EXISTS "IDX_program_tasks_series_season" ON "program_tasks" ("series_title", "season");
