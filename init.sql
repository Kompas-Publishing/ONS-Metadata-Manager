-- Broadcast Metadata Management System - Database Initialization Script
-- Run this script in your Neon SQL Editor to create all required tables

-- Enable UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Session Storage Table
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);

-- ============================================================
-- Groups Table (for group-based file visibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Users Table (supports password and OAuth authentication)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR, -- Nullable for OAuth users
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  auth_provider VARCHAR DEFAULT 'local', -- local, google, github, etc.
  is_admin INTEGER DEFAULT 0 NOT NULL, -- 0 = regular, 1 = admin
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, active, archived
  can_read INTEGER DEFAULT 0 NOT NULL, -- 0 = no, 1 = yes
  can_write INTEGER DEFAULT 0 NOT NULL, -- 0 = no, 1 = yes
  can_edit INTEGER DEFAULT 0 NOT NULL, -- 0 = no, 1 = yes
  file_visibility VARCHAR(20) DEFAULT 'own' NOT NULL, -- own, all, group
  group_ids TEXT[] DEFAULT ARRAY[]::text[], -- Array of group IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Metadata Files Table (25+ fields for broadcast content)
-- ============================================================
CREATE TABLE IF NOT EXISTS metadata_files (
  id VARCHAR PRIMARY KEY, -- Format: xxx-xxx-xxx (e.g., 077-362-001)
  title TEXT NOT NULL,
  season INTEGER, -- Season number
  episode INTEGER, -- Episode number
  duration VARCHAR, -- HH:MM:SS format
  break_time VARCHAR, -- Legacy single break time (HH:MM:SS)
  break_times TEXT[] DEFAULT ARRAY[]::text[], -- Array of break times
  end_credits VARCHAR, -- HH:MM:SS format
  description TEXT,
  actors TEXT[], -- Array of actor names
  genre TEXT[], -- Array of genres
  tags TEXT[] DEFAULT ARRAY[]::text[], -- Event tags (Christmas, Easter, etc.)
  season_type VARCHAR(50), -- Winter, Summer, Autumn, Spring
  content_type VARCHAR(100), -- Long Form, Short Form, Promotional, etc.
  category VARCHAR(50), -- Series, Movie, Documentary
  -- Additional broadcast metadata
  channel TEXT, -- Broadcasting channel
  audio_id VARCHAR, -- Audio identifier
  original_filename TEXT, -- Original source filename
  program_rating VARCHAR, -- AL, 6, 9, 12, 16, 18
  production_country VARCHAR, -- Country of production
  series_title TEXT, -- Series title
  year_of_production INTEGER, -- Production year
  catch_up INTEGER, -- 0 or 1 (boolean)
  episode_count INTEGER, -- Total episodes in series
  episode_title TEXT, -- Episode-specific title
  episode_description TEXT, -- Episode-specific description
  segmented INTEGER, -- 0 or 1 (boolean)
  date_start TIMESTAMP, -- Availability start date
  date_end TIMESTAMP, -- Availability end date
  subtitles INTEGER, -- 0 or 1 (boolean)
  subtitles_id VARCHAR, -- Subtitle identifier
  created_by VARCHAR REFERENCES users(id),
  group_id VARCHAR REFERENCES groups(id), -- Group assignment
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Settings Table (stores system settings like next ID counter)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize the starting ID counter (starts at 77362)
INSERT INTO settings (key, value, updated_at)
VALUES ('next_id', '77362', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- User-Defined Tags Table (custom genres, content types, tags)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_defined_tags (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- genre, contentType, tags
  value VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Metadata files indexes
CREATE INDEX IF NOT EXISTS idx_metadata_title ON metadata_files(title);
CREATE INDEX IF NOT EXISTS idx_metadata_season ON metadata_files(season);
CREATE INDEX IF NOT EXISTS idx_metadata_created_by ON metadata_files(created_by);
CREATE INDEX IF NOT EXISTS idx_metadata_group_id ON metadata_files(group_id);
CREATE INDEX IF NOT EXISTS idx_metadata_created_at ON metadata_files(created_at);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- User-defined tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON user_defined_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_type ON user_defined_tags(type);

-- ============================================================
-- COMPLETE! All tables created.
-- ============================================================

-- Next steps:
-- 1. Create your first admin user manually (see instructions below)
-- 2. Update your .env file with DATABASE_URL and SESSION_SECRET
-- 3. Deploy your application

-- ============================================================
-- OPTIONAL: Create First Admin User
-- ============================================================
-- After running this script, you can create an admin user manually:
--
-- Step 1: Generate a password hash (run this in your application environment with bcrypt):
--   bcrypt.hashSync('YourPassword123!', 12)
--
-- Step 2: Insert the admin user (replace $HASH with your generated hash):
--
-- INSERT INTO users (
--   id,
--   email,
--   password,
--   first_name,
--   last_name,
--   status,
--   can_read,
--   can_write,
--   can_edit,
--   is_admin,
--   file_visibility
-- ) VALUES (
--   gen_random_uuid()::text,
--   'admin@example.com',
--   '$2a$12$YOUR_HASH_HERE',
--   'Admin',
--   'User',
--   'active',
--   1,
--   1,
--   1,
--   1,
--   'all'
-- );
