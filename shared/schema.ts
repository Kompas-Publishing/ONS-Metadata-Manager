import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Groups table for group-based file visibility
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

// User storage table - Supports both password and OAuth authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // Nullable - only set for password-based auth, not OAuth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  authProvider: varchar("auth_provider").default("local"), // local, google, github, etc.
  isAdmin: integer("is_admin").default(0).notNull(), // 0 = regular user, 1 = super admin
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, active, archived
  canReadMetadata: integer("can_read_metadata").default(1).notNull(),
  canWriteMetadata: integer("can_write_metadata").default(0).notNull(),
  canReadLicenses: integer("can_read_licenses").default(1).notNull(),
  canWriteLicenses: integer("can_write_licenses").default(0).notNull(),
  canReadTasks: integer("can_read_tasks").default(1).notNull(),
  canWriteTasks: integer("can_write_tasks").default(0).notNull(),
  canUseAI: integer("can_use_ai").default(0).notNull(),
  canUseAIChat: integer("can_use_ai_chat").default(0).notNull(),
  fileVisibility: varchar("file_visibility", { length: 20 }).default("own").notNull(), // own, all, group
  groupIds: text("group_ids").array().default(sql`ARRAY[]::text[]`), // Array of group IDs user belongs to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// License table
export const licenses = pgTable("licenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  distributor: text("distributor"),
  contentTitle: text("content_title"),
  licenseFeeCurrency: varchar("license_fee_currency", { length: 10 }).default("EUR"),
  licenseFeeAmount: text("license_fee_amount"),
  licenseFeePaid: integer("license_fee_paid").default(0),
  licenseStart: timestamp("license_start"),
  licenseEnd: timestamp("license_end"),
  allowedRuns: text("allowed_runs"),
  contentRating: text("content_rating"),
  description: text("description"),
  imdbLink: text("imdb_link"),
  googleDriveLink: text("google_drive_link"),
  notes: text("notes"),
  productionYear: integer("production_year"),
  subsFromDistributor: integer("subs_from_distributor").default(0),
  season: text("season"), // e.g. "1" or "1, 2, 4"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLicenseSchema = createInsertSchema(licenses, {
  name: z.string().min(1, "Name is required"),
  distributor: z.string().optional(),
  contentTitle: z.string().optional(),
  licenseFeeCurrency: z.string().optional(),
  licenseFeeAmount: z.string().optional(),
  licenseFeePaid: z.number().int().min(0).max(1).optional(),
  licenseStart: z.coerce.date().optional(),
  licenseEnd: z.coerce.date().optional(),
  allowedRuns: z.string().optional(),
  contentRating: z.string().optional(),
  description: z.string().optional(),
  imdbLink: z.string().optional(),
  googleDriveLink: z.string().optional(),
  notes: z.string().optional(),
  productionYear: z.number().int().optional(),
  subsFromDistributor: z.number().int().min(0).max(1).optional(),
  season: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type License = typeof licenses.$inferSelect;

// Series table
export const seriesTable = pgTable("series", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull().unique(),
  productionYear: integer("production_year"),
  driveLinks: jsonb("drive_links").default(sql`'[]'::jsonb`).notNull(), // Array of { name: string, url: string }
  websiteLink: text("website_link"),
  subsFromDistributor: integer("subs_from_distributor").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SeriesItem = typeof seriesTable.$inferSelect;
export type Series = SeriesItem;
export type InsertSeries = typeof seriesTable.$inferInsert;

// Join table for many-to-many Series-License relationship
export const seriesToLicenses = pgTable("series_to_licenses", {
  seriesId: varchar("series_id").notNull().references(() => seriesTable.id, { onDelete: "cascade" }),
  licenseId: varchar("license_id").notNull().references(() => licenses.id, { onDelete: "cascade" }),
  seasonRange: text("season_range"), // E.G. "1-4"
}, (t) => [
  uniqueIndex("series_license_unique_idx").on(t.seriesId, t.licenseId),
]);

export type SeriesToLicense = typeof seriesToLicenses.$inferSelect;
export type InsertSeriesToLicense = typeof seriesToLicenses.$inferInsert;

// Metadata files table
export const metadataFiles = pgTable("metadata_files", {
  id: varchar("id").primaryKey(), // e.g., "77362"
  title: text("title").notNull(),
  season: integer("season"), // Season number (1, 2, 3...)
  episode: integer("episode"), // Episode number
  duration: varchar("duration"), // Duration in HH:MM:SS format
  breakTime: varchar("break_time"), // Legacy break time in HH:MM:SS format (kept for compatibility)
  breakTimes: text("break_times").array().default(sql`ARRAY[]::text[]`), // Array of break times
  endCredits: varchar("end_credits"), // End credits duration in HH:MM:SS format
  description: text("description"),
  actors: text("actors").array(), // Array of actor names
  genre: text("genre").array(), // Array of genres
  tags: text("tags").array().default(sql`ARRAY[]::text[]`), // Seasonal/event tags (Christmas, Sinterklaas, Easter, New Years, etc.)
  seasonType: varchar("season_type", { length: 50 }), // Winter, Summer, Autumn, Spring
  contentType: varchar("content_type", { length: 100 }), // Long Form, Short Form, Promotional, Ad, etc.
  category: varchar("category", { length: 50 }), // Series, Movie, Documentary
  // New fields from Excel template
  channel: text("channel"), // Broadcasting channel
  audioId: varchar("audio_id"), // Audio identifier (defaults to file ID)
  originalFilename: text("original_filename"), // Original source filename
  programRating: varchar("program_rating"), // Content rating (AL, 6, 9, 12, 16, 18)
  productionCountry: varchar("production_country"), // Country of production
  seriesTitle: text("series_title"), // Series title
  yearOfProduction: integer("year_of_production"), // Production year
  catchUp: integer("catch_up"), // Catch-up availability (0 or 1 as boolean)
  episodeCount: integer("episode_count"), // Total number of episodes in series
  episodeTitle: text("episode_title"), // Episode-specific title
  episodeDescription: text("episode_description"), // Episode-specific description
  segmented: integer("segmented"), // Segmentation flag (0 or 1 as boolean)
  dateStart: timestamp("date_start"), // Availability start date
  dateEnd: timestamp("date_end"), // Availability end date
  subtitles: integer("subtitles"), // Subtitle availability (0 or 1 as boolean)
  subtitlesId: varchar("subtitles_id"), // Subtitle identifier
  googleDriveLink: text("google_drive_link"),
  subsStatus: varchar("subs_status", { length: 50 }).default("Incomplete"),
  metadataTimesStatus: varchar("metadata_times_status", { length: 50 }).default("Incomplete"),
  seriesId: varchar("series_id").references(() => seriesTable.id, { onDelete: "set null" }),
  draft: integer("draft").default(0), // Draft status (0 = published, 1 = draft)
  licenseId: varchar("license_id").references(() => licenses.id, { onDelete: "set null" }), // Legacy: Single link to license
  createdBy: varchar("created_by").references(() => users.id),
  groupId: varchar("group_id").references(() => groups.id), // Group assignment for group-based visibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_metadata_created_by").on(table.createdBy),
  index("idx_metadata_group_id").on(table.groupId),
  index("idx_metadata_title").on(table.title),
  index("idx_metadata_series_id").on(table.seriesId),
  index("idx_metadata_created_at").on(table.createdAt),
  index("idx_metadata_license_id").on(table.licenseId),
]);

// Join table for many-to-many Metadata-License relationship
export const metadataToLicenses = pgTable("metadata_to_licenses", {
  metadataFileId: varchar("metadata_file_id").notNull().references(() => metadataFiles.id, { onDelete: "cascade" }),
  licenseId: varchar("license_id").notNull().references(() => licenses.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("metadata_license_unique_idx").on(t.metadataFileId, t.licenseId),
]);

export const insertMetadataFileSchema = createInsertSchema(metadataFiles, {
  title: z.string().min(1, "Title is required"),
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional(),
  duration: z.string().min(1, "Duration is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Duration must be in HH:MM:SS format"),
  breakTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).nullable().optional(),
  breakTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)).optional().default([]),
  endCredits: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).optional(),
  description: z.string().optional(),
  actors: z.array(z.string()).optional(),
  genre: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional().default([]),
  seasonType: z.enum(["Winter", "Summer", "Autumn", "Spring"]).optional(),
  contentType: z.string().min(1, "Content Type is required"),
  category: z.enum(["Series", "Movie", "Documentary"]).optional(),
  // New field validations
  channel: z.string().optional(),
  audioId: z.string().optional(),
  originalFilename: z.string().optional(),
  programRating: z.enum(["AL", "6", "9", "12", "16", "18"]).optional(),
  productionCountry: z.string().optional(),
  seriesTitle: z.string().optional(),
  yearOfProduction: z.number().int().positive().max(new Date().getFullYear(), "Year must be in the past or current year").optional(),
  catchUp: z.number().int().min(0).max(1).optional(),
  episodeCount: z.number().int().positive().optional(),
  episodeTitle: z.string().optional(),
  episodeDescription: z.string().optional(),
  segmented: z.number().int().min(0).max(1).optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  subtitles: z.number().int().min(0).max(1).optional(),
  subtitlesId: z.string().optional(),
  googleDriveLink: z.string().optional(),
  subsStatus: z.string().optional(),
  metadataTimesStatus: z.string().optional(),
  seriesId: z.string().nullable().optional(),
  draft: z.number().int().min(0).max(1).optional(),
  licenseId: z.string().optional(),
}).extend({
  licenseIds: z.array(z.string()).optional(), // Support for multiple licenses
}).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMetadataFile = z.infer<typeof insertMetadataFileSchema>;
export type MetadataFile = typeof metadataFiles.$inferSelect;

// License Batch Generate Schema
export const licenseBatchGenerateSchema = z.object({
  licenseId: z.string(),
  seriesTitle: z.string().min(1, "Series Title is required"),
  seasonStart: z.number().int().positive(),
  seasonEnd: z.number().int().positive(),
  episodesPerSeason: z.number().int().positive(),
});

export type LicenseBatchGenerate = z.infer<typeof licenseBatchGenerateSchema>;

// Enhanced batch creation schema
export const batchSeasonSchema = z.object({
  season: z.number().int().positive(),
  episodeCount: z.number().int().positive().min(1).max(100),
  startEpisode: z.number().int().positive().default(1),
});

export type BatchSeason = z.infer<typeof batchSeasonSchema>;

export const enhancedBatchCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(["Series", "Movie", "Documentary"]).default("Series"),
  seasons: z.array(batchSeasonSchema).min(1, "At least one season is required"),
  duration: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).optional(),
  breakTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).nullable().optional(),
  breakTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)).optional().default([]),
  endCredits: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).optional(),
  seasonType: z.enum(["Winter", "Summer", "Autumn", "Spring"]).optional(),
  contentType: z.string().optional(),
  description: z.string().optional(),
  genre: z.array(z.string()).optional().default([]),
  actors: z.array(z.string()).optional().default([]),
  channel: z.string().optional().default("ONS"),
  audioId: z.string().optional(),
  seriesTitle: z.string().optional(),
  programRating: z.enum(["AL", "6", "9", "12", "16", "18"]).optional(),
  productionCountry: z.string().optional(),
  yearOfProduction: z.number().int().positive().max(new Date().getFullYear(), "Year must be in the past or current year").optional(),
  catchUp: z.number().int().min(0).max(1).optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  subtitles: z.number().int().min(0).max(1).optional(),
  segmented: z.number().int().min(0).max(1).optional(),
  googleDriveLink: z.string().optional(),
  draft: z.number().int().min(0).max(1).optional().default(1),
  licenseId: z.string().optional(),
  taskDescription: z.string().optional(),
});

export type EnhancedBatchCreate = z.infer<typeof enhancedBatchCreateSchema>;

export const multiBatchCreateSchema = z.object({
  batches: z.array(enhancedBatchCreateSchema).min(1),
});

export type MultiBatchCreate = z.infer<typeof multiBatchCreateSchema>;

// Batch creation schema (Original, kept for backward compatibility)
export const batchCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  season: z.number().int().positive(),
  startEpisode: z.number().int().positive().default(1),
  episodeCount: z.number().int().positive().min(1).max(100),
  duration: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).optional(),
  breakTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).nullable().optional(),
  breakTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)).optional().default([]),
  endCredits: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).or(z.literal("")).optional(),
  category: z.enum(["Series", "Movie", "Documentary"]).default("Series"),
  seasonType: z.enum(["Winter", "Summer", "Autumn", "Spring"]).optional(),
  contentType: z.string().optional(),
  // Batch-level fields that apply to all episodes
  description: z.string().optional(),
  genre: z.array(z.string()).optional().default([]),
  actors: z.array(z.string()).optional().default([]),
  channel: z.string().optional(),
  audioId: z.string().optional(),
  seriesTitle: z.string().optional(),
  programRating: z.enum(["AL", "6", "9", "12", "16", "18"]).optional(),
  productionCountry: z.string().optional(),
  yearOfProduction: z.number().int().positive().max(new Date().getFullYear(), "Year must be in the past or current year").optional(),
  catchUp: z.number().int().min(0).max(1).optional(),
  dateStart: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  subtitles: z.number().int().min(0).max(1).optional(),
  segmented: z.number().int().min(0).max(1).optional(),
  googleDriveLink: z.string().optional(),
  draft: z.number().int().min(0).max(1).optional(),
  taskDescription: z.string().optional(),
});

export type BatchCreate = z.infer<typeof batchCreateSchema>;

// Settings table for storing the next ID counter
export const settings = pgTable("settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Setting = typeof settings.$inferSelect;

// User-defined tags table for custom genres and content types
export const userDefinedTags = pgTable("user_defined_tags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  value: varchar("value", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserDefinedTagSchema = createInsertSchema(userDefinedTags, {
  userId: z.string(),
  type: z.enum(["genre", "contentType", "tags"]),
  value: z.string().min(1).max(100),
}).omit({ id: true, createdAt: true });

export type InsertUserDefinedTag = z.infer<typeof insertUserDefinedTagSchema>;
export type UserDefinedTag = typeof userDefinedTags.$inferSelect;

// Tasks table for metadata files
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  metadataFileId: varchar("metadata_file_id").notNull().references(() => metadataFiles.id),
  description: text("description").notNull(), // e.g., "heeft meta nodig"
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, in_progress, completed
  deadline: timestamp("deadline"), // Optional deadline for the task
  assignedTo: varchar("assigned_to").references(() => users.id),
  priority: varchar("priority", { length: 10 }).default("medium").notNull(), // low, medium, high
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tasks_metadata_file_id").on(table.metadataFileId),
]);

export const insertTaskSchema = createInsertSchema(tasks, {
  metadataFileId: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  deadline: z.coerce.date().optional(),
  assignedTo: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
}).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
