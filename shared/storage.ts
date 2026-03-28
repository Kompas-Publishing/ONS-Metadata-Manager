// Escape special LIKE pattern characters to prevent unintended wildcard matching
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Compact sorted season numbers into range string: [1,2,3,5,7,8] => "1-3, 5, 7-8"
function compactSeasonRange(seasons: number[]): string {
  if (seasons.length === 0) return "";
  const ranges: string[] = [];
  let start = seasons[0], end = seasons[0];
  for (let i = 1; i < seasons.length; i++) {
    if (seasons[i] === end + 1) {
      end = seasons[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = seasons[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

import {
  users,
  metadataFiles,
  settings,
  userDefinedTags,
  groups,
  licenses,
  metadataToLicenses,
  tasks,
  seriesTable,
  seriesToLicenses,
  contracts,
  contractsToLicenses,
  type User,
  type UpsertUser,
  type MetadataFile,
  type InsertMetadataFile,
  type BatchCreate,
  type EnhancedBatchCreate,
  type Setting,
  type UserDefinedTag,
  type InsertUserDefinedTag,
  type Group,
  type InsertGroup,
  type InsertLicense,
  type License,
  type LicenseBatchGenerate,
  type Task,
  type InsertTask,
  type Series,
  type InsertSeries,
  type SeriesToLicense,
  type InsertSeriesToLicense,
  type Contract,
  type InsertContract,
} from "./schema.js";
import { db } from "./db.js";
import { eq, desc, sql, gte, and, inArray, or } from "drizzle-orm";
import { UserPermissions, getFileVisibilityConditions } from "./permissions.js";

// Extend MetadataFile type to include licenseIds array
export type MetadataFileWithLicenses = MetadataFile & { licenseIds?: string[] };

export type IStorage = {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  peekNextId(): Promise<string>;
  consumeNextId(): Promise<string>;
  getMetadataFile(id: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses | undefined>;
  getMetadataByIds(ids: string[], permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  getAllMetadataFiles(permissions: UserPermissions, licenseId?: string): Promise<MetadataFileWithLicenses[]>;
  getRecentMetadataFiles(limit: number, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  createMetadataFile(file: InsertMetadataFile & { licenseIds?: string[] }, id: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses>;
  updateMetadataFile(id: string, file: InsertMetadataFile & { licenseIds?: string[] }, permissions: UserPermissions): Promise<MetadataFileWithLicenses | undefined>;
  upsertMetadataFile(file: InsertMetadataFile & { licenseIds?: string[] }, permissions: UserPermissions, originalId?: string): Promise<MetadataFileWithLicenses>;
  bulkUpdateMetadata(updates: Array<{id: string, data: Partial<InsertMetadataFile> & { licenseIds?: string[] }}>, permissions: UserPermissions): Promise<number>;
  deleteMetadataFile(id: string, permissions: UserPermissions): Promise<boolean>;
  deleteMetadataBySeries(seriesTitle: string, permissions: UserPermissions): Promise<number>;
  deleteMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<number>;
  createBatchMetadataFiles(batch: BatchCreate & { licenseIds?: string[] }, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  getStats(permissions: UserPermissions): Promise<{ totalFiles: number; recentFiles: number; totalSeries: number; overdueTasks: number; expiringLicenses: number; incompleteMeta: number; drafts: number }>;
  getMetadataBySeriesTitle(seriesTitle: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  getMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  getAdjacentEpisodes(id: string, permissions: UserPermissions): Promise<{ prev: MetadataFileWithLicenses | null; next: MetadataFileWithLicenses | null }>;
  searchMetadata(keyword: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;
  searchLicenses(keyword: string): Promise<License[]>;
  searchTasks(keyword: string, permissions: UserPermissions): Promise<(Task & { metadataFile: MetadataFileWithLicenses })[]>;

  getUserTags(userId: string, type: string): Promise<UserDefinedTag[]>;
  createUserTag(data: InsertUserDefinedTag): Promise<UserDefinedTag>;
  deleteUserTag(id: number, userId: string): Promise<void>;

  listAllUsers(): Promise<User[]>;
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined>;
  updateUserStatus(userId: string, status: string): Promise<User | undefined>;
  updateUserPermissions(userId: string, permissions: {
    canReadMetadata: number,
    canWriteMetadata: number,
    canReadLicenses: number,
    canWriteLicenses: number,
    canReadTasks: number,
    canWriteTasks: number,
    canUseAI: number,
    canUseAIChat: number
  }): Promise<User | undefined>;
  updateUserPassword(userId: string, passwordHash: string): Promise<User | undefined>;
  updateUserVisibility(userId: string, fileVisibility: string): Promise<User | undefined>;
  updateUserGroups(userId: string, groupIds: string[]): Promise<User | undefined>;
  updateUserProfile(userId: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(userId: string): Promise<boolean>;
  getUsersByGroupId(groupId: string): Promise<User[]>;

  createGroup(group: InsertGroup): Promise<Group>;
  getAllGroups(): Promise<Group[]>;
  deleteGroup(groupId: string): Promise<boolean>;

  // Multi-batch creation
  createMultiBatchMetadataFiles(data: { batches: EnhancedBatchCreate[], taskDescription?: string }, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]>;

  // License Management
  createLicense(license: InsertLicense): Promise<License>;
  getLicense(id: string): Promise<License | undefined>;
  listLicenses(): Promise<License[]>;
  updateLicense(id: string, license: Partial<InsertLicense>): Promise<License | undefined>;
  deleteLicense(id: string): Promise<boolean>;
  generateLicenseDrafts(data: LicenseBatchGenerate, userId: string): Promise<MetadataFileWithLicenses[]>;
  linkMetadataToLicense(licenseId: string, metadataIds: string[]): Promise<number>;
  unlinkMetadataFromLicense(licenseId: string, metadataIds: string[]): Promise<number>;
  getSeriesLicensesFromEpisodes(seriesId: string): Promise<(License & { seasonRange: string | null })[]>;

  // Task Management
  createTask(task: InsertTask & { createdBy: string }): Promise<Task>;
  bulkCreateTasks(taskData: { metadataFileIds: string[], description: string, deadline?: Date | null, assignedTo?: string, priority?: string, createdBy: string }): Promise<Task[]>;
  listTasks(permissions: UserPermissions, status?: string, assignedTo?: string): Promise<(Task & { metadataFile: MetadataFileWithLicenses })[]>;
  getTasksByFileId(fileId: string, permissions: UserPermissions): Promise<Task[]>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  bulkDeleteTasks(ids: number[]): Promise<boolean>;

  // Series Management
  getSeriesById(id: string): Promise<Series | undefined>;
  getSeriesByTitle(title: string): Promise<Series | undefined>;
  getAllSeries(): Promise<Series[]>;
  upsertSeries(data: InsertSeries): Promise<Series>;
  deleteSeries(id: string): Promise<boolean>;
  linkSeriesToLicense(seriesId: string, licenseId: string, seasonRange?: string): Promise<void>;
  unlinkSeriesFromLicense(seriesId: string, licenseId: string): Promise<void>;
  getSeriesLicenses(seriesId: string): Promise<(License & { seasonRange: string | null })[]>;
  getSeriesTasks(seriesId: string, permissions: UserPermissions): Promise<(Task & { metadataFile: MetadataFileWithLicenses })[]>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;
  getSettingsByKeys(keys: string[]): Promise<Setting[]>;
};

function formatMetadataId(num: number): string {
  const segment3 = String(num % 1000).padStart(3, '0');
  const segment2 = String(Math.floor(num / 1000) % 1000).padStart(3, '0');
  const segment1 = String(Math.floor(num / 1000000) % 1000).padStart(3, '0');
  return `${segment1}-${segment2}-${segment3}`;
}

function parseMetadataId(id: string): number {
  // Parse format: xxx-xxx-xxx back to number
  const parts = id.split('-');
  if (parts.length !== 3) return 0;
  const s1 = parseInt(parts[0], 10);
  const s2 = parseInt(parts[1], 10);
  const s3 = parseInt(parts[2], 10);
  if (isNaN(s1) || isNaN(s2) || isNaN(s3)) return 0;
  return s1 * 1000000 + s2 * 1000 + s3;
}

function normalizeMetadataFile(file: MetadataFile, linkedLicenseIds: string[] = []): MetadataFileWithLicenses {
  // Normalize breakTimes and ensure breakTime is synced
  const breakTimes = file.breakTimes || (file.breakTime ? [file.breakTime] : []);
  const breakTime = breakTimes.length > 0 ? breakTimes[0] : file.breakTime;

  return {
    ...file,
    breakTime,
    breakTimes,
    licenseIds: [...linkedLicenseIds],
  };
}

export class DatabaseStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async peekNextId(): Promise<string> {
    // IDs are randomly generated — return a preview candidate
    return this.consumeNextId();
  }

  async consumeNextId(): Promise<string> {
    // Generate a random numeric ID and check for collisions
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomNum = Math.floor(Math.random() * 900000000) + 100000; // 100000 to 999999999
      const candidateId = formatMetadataId(randomNum);

      const [existing] = await db
        .select({ id: metadataFiles.id })
        .from(metadataFiles)
        .where(eq(metadataFiles.id, candidateId))
        .limit(1);

      if (!existing) {
        return candidateId;
      }
    }
    throw new Error("Failed to generate unique ID after maximum attempts");
  }

  async getMetadataFile(id: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses | undefined> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [eq(metadataFiles.id, id)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const results = await db
      .select({
        file: metadataFiles,
        licenseLink: metadataToLicenses.licenseId
      })
      .from(metadataFiles)
      .leftJoin(metadataToLicenses, eq(metadataFiles.id, metadataToLicenses.metadataFileId))
      .where(and(...whereConditions));

    if (results.length === 0) return undefined;

    const file = results[0].file;
    const linkedLicenseIds = results
      .map(r => r.licenseLink)
      .filter((id): id is string => id !== null);

    return normalizeMetadataFile(file, linkedLicenseIds);
  }

  async getMetadataByIds(ids: string[], permissions: UserPermissions): Promise<MetadataFileWithLicenses[]> {
    if (ids.length === 0) {
      return [];
    }

    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [inArray(metadataFiles.id, ids)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const results = await db
      .select({
        file: metadataFiles,
        licenseLink: metadataToLicenses.licenseId
      })
      .from(metadataFiles)
      .leftJoin(metadataToLicenses, eq(metadataFiles.id, metadataToLicenses.metadataFileId))
      .where(and(...whereConditions));

    // Group by file ID to handle multiple licenses per file
    const fileMap = new Map<string, { file: MetadataFile, licenseIds: string[] }>();
    for (const r of results) {
      if (!fileMap.has(r.file.id)) {
        fileMap.set(r.file.id, { file: r.file, licenseIds: [] });
      }
      if (r.licenseLink) {
        fileMap.get(r.file.id)!.licenseIds.push(r.licenseLink);
      }
    }

    return Array.from(fileMap.values()).map(item => normalizeMetadataFile(item.file, item.licenseIds));
  }

  async getAllMetadataFiles(permissions: UserPermissions, licenseId?: string): Promise<MetadataFileWithLicenses[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    if (licenseId) {
      // Find files linked to this license via the join table
      whereConditions.push(
        sql`${metadataFiles.id} IN (SELECT metadata_file_id FROM metadata_to_licenses WHERE license_id = ${licenseId})`
      );
    }

    const results = await db
      .select({
        file: metadataFiles,
        licenseLink: metadataToLicenses.licenseId
      })
      .from(metadataFiles)
      .leftJoin(metadataToLicenses, eq(metadataFiles.id, metadataToLicenses.metadataFileId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(metadataFiles.createdAt));

    const fileMap = new Map<string, { file: MetadataFile, licenseIds: string[] }>();
    for (const r of results) {
      if (!fileMap.has(r.file.id)) {
        fileMap.set(r.file.id, { file: r.file, licenseIds: [] });
      }
      if (r.licenseLink) {
        fileMap.get(r.file.id)!.licenseIds.push(r.licenseLink);
      }
    }

    return Array.from(fileMap.values()).map(item => normalizeMetadataFile(item.file, item.licenseIds));
  }

  async getRecentMetadataFiles(limit: number, permissions: UserPermissions): Promise<MetadataFileWithLicenses[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const results = await db
      .select({
        file: metadataFiles,
        licenseLink: metadataToLicenses.licenseId
      })
      .from(metadataFiles)
      .leftJoin(metadataToLicenses, eq(metadataFiles.id, metadataToLicenses.metadataFileId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(metadataFiles.createdAt))
      .limit(limit);

    const fileMap = new Map<string, { file: MetadataFile, licenseIds: string[] }>();
    for (const r of results) {
      if (!fileMap.has(r.file.id)) {
        fileMap.set(r.file.id, { file: r.file, licenseIds: [] });
      }
      if (r.licenseLink) {
        fileMap.get(r.file.id)!.licenseIds.push(r.licenseLink);
      }
    }

    return Array.from(fileMap.values()).map(item => normalizeMetadataFile(item.file, item.licenseIds));
  }

  async createMetadataFile(file: InsertMetadataFile & { licenseIds?: string[]; taskDescription?: string }, id: string, permissions: UserPermissions): Promise<MetadataFileWithLicenses> {
    const { licenseIds, taskDescription, ...data } = file;

    // Normalize breakTimes array - filter empty strings and trim
    const normalizedBreakTimes = (data.breakTimes || [])
      .filter(t => t && typeof t === 'string' && t.trim())
      .map(t => t.trim());

    // Compute breakTime from normalized breakTimes, or use provided breakTime
    const normalizedBreakTime = normalizedBreakTimes.length > 0
      ? normalizedBreakTimes[0]
      : (data.breakTime && data.breakTime.trim() ? data.breakTime.trim() : null);

    // Ensure breakTimes is populated from breakTime if empty
    const finalBreakTimes = normalizedBreakTimes.length > 0
      ? normalizedBreakTimes
      : (normalizedBreakTime ? [normalizedBreakTime] : []);

    // Ensure seriesId is set if seriesTitle or title is available
    let seriesId = data.seriesId;
    const seriesTitle = data.seriesTitle || data.title;
    if (!seriesId && seriesTitle) {
      const s = await this.upsertSeries({ title: seriesTitle });
      seriesId = s.id;
    }

    const fileData: any = {
      ...data,
      seriesId,
      breakTime: normalizedBreakTime,
      breakTimes: finalBreakTimes,
      id,
      createdBy: permissions.userId,
    };

    if (permissions.fileVisibility === "group" && permissions.groupIds && permissions.groupIds.length > 0) {
      fileData.groupId = permissions.groupIds[0];
    }

    const [created] = await db
      .insert(metadataFiles)
      .values(fileData)
      .returning();

    if (licenseIds && licenseIds.length > 0) {
      const links = licenseIds.map(lId => ({
        metadataFileId: id,
        licenseId: lId
      }));
      await db.insert(metadataToLicenses).values(links);
    }

    // Create task if description provided
    if (taskDescription) {
      await db.insert(tasks).values({
        metadataFileId: id,
        description: taskDescription,
        status: "pending",
        createdBy: permissions.userId,
      });
    }

    return normalizeMetadataFile(created, licenseIds || []);
  }

  async updateMetadataFile(id: string, file: Partial<InsertMetadataFile> & { licenseIds?: string[] }, permissions: UserPermissions): Promise<MetadataFileWithLicenses | undefined> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [eq(metadataFiles.id, id)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const { licenseIds, ...data } = file;

    // Normalize breakTimes array - filter empty strings and trim
    const normalizedBreakTimes = (data.breakTimes || [])
      .filter(t => t && typeof t === 'string' && t.trim())
      .map(t => t.trim());

    // Compute breakTime from normalized breakTimes, or use provided breakTime
    const normalizedBreakTime = normalizedBreakTimes.length > 0
      ? normalizedBreakTimes[0]
      : (data.breakTime && data.breakTime.trim() ? data.breakTime.trim() : null);

    // Ensure breakTimes is populated from breakTime if empty
    const finalBreakTimes = normalizedBreakTimes.length > 0
      ? normalizedBreakTimes
      : (normalizedBreakTime ? [normalizedBreakTime] : []);

    // Ensure seriesId is set if seriesTitle or title is available
    let seriesId = data.seriesId;
    const seriesTitle = data.seriesTitle || data.title;
    if (!seriesId && seriesTitle) {
      const s = await this.upsertSeries({ title: seriesTitle });
      seriesId = s.id;
    }

    const [updated] = await db
      .update(metadataFiles)
      .set({
        ...data,
        seriesId,
        breakTime: normalizedBreakTime,
        breakTimes: finalBreakTimes,
        updatedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning();

    if (!updated) return undefined;

    // Update join table if licenseIds provided
    if (licenseIds !== undefined) {
      // Clear existing
      await db.delete(metadataToLicenses).where(eq(metadataToLicenses.metadataFileId, id));

      // Add new
      if (licenseIds.length > 0) {
        const links = licenseIds.map(lId => ({
          metadataFileId: id,
          licenseId: lId
        }));
        await db.insert(metadataToLicenses).values(links);
      }
    }

    // Fetch final license set
    const finalLinks = await db
      .select()
      .from(metadataToLicenses)
      .where(eq(metadataToLicenses.metadataFileId, id));

    const finalLicenseIds = finalLinks.map(l => l.licenseId);

    return normalizeMetadataFile(updated, finalLicenseIds);
  }

  async upsertMetadataFile(file: InsertMetadataFile & { licenseIds?: string[] }, permissions: UserPermissions, originalId?: string): Promise<MetadataFileWithLicenses> {
    const { licenseIds, ...data } = file;
    let existingFile: MetadataFile | undefined;

    // 1. Try to find by originalId if provided
    if (originalId) {
      // For upsert match, we check visibility
      const visibility = getFileVisibilityConditions(permissions);
      const whereConditions = [eq(metadataFiles.id, originalId)];

      if (visibility.type === "own") {
        whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
      } else if (visibility.type === "group") {
        if (visibility.groupIds && visibility.groupIds.length > 0) {
          whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        } else {
          whereConditions.push(sql`1 = 0`);
        }
      }

      const [res] = await db
        .select()
        .from(metadataFiles)
        .where(and(...whereConditions));
      existingFile = res;
    }

    // 2. If not found by ID, try to find by series title, season, and episode
    if (!existingFile && data.seriesTitle && data.season && data.episode) {
      const visibility = getFileVisibilityConditions(permissions);
      const whereConditions = [
        eq(metadataFiles.seriesTitle, data.seriesTitle),
        eq(metadataFiles.season, data.season),
        eq(metadataFiles.episode, data.episode)
      ];

      if (visibility.type === "own") {
        whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
      } else if (visibility.type === "group") {
        if (visibility.groupIds && visibility.groupIds.length > 0) {
          whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        } else {
          whereConditions.push(sql`1 = 0`);
        }
      }

      const [res] = await db
        .select()
        .from(metadataFiles)
        .where(and(...whereConditions));
      existingFile = res;
    }

    // 3. Ensure series exists and get its ID
    let seriesId: string | null = null;
    const seriesTitle = data.seriesTitle || data.title;
    if (seriesTitle) {
      const s = await this.upsertSeries({ title: seriesTitle });
      seriesId = s.id;
      data.seriesId = seriesId;
    }

    if (existingFile) {
      // Update
      const updated = await this.updateMetadataFile(existingFile.id, { ...data, licenseIds }, permissions);
      if (!updated) {
        // This shouldn't happen given we checked visibility above, but as a fallback
        const newId = await this.consumeNextId();
        return await this.createMetadataFile({ ...data, licenseIds }, newId, permissions);
      }
      return updated;
    } else {
      // Create
      const newId = await this.consumeNextId();
      return await this.createMetadataFile({ ...data, licenseIds }, newId, permissions);
    }
  }

  async bulkUpdateMetadata(updates: Array<{id: string, data: Partial<InsertMetadataFile>}>, permissions: UserPermissions): Promise<number> {
    if (updates.length > 500) {
      throw new Error("Bulk update limit exceeded: maximum 500 records per request.");
    }
    const visibility = getFileVisibilityConditions(permissions);

    return await db.transaction(async (tx) => {
      let count = 0;
      for (const update of updates) {
        const whereConditions = [eq(metadataFiles.id, update.id)];

        if (visibility.type === "own") {
          whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
        } else if (visibility.type === "group") {
          if (visibility.groupIds && visibility.groupIds.length > 0) {
            whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
            whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
          } else {
            whereConditions.push(sql`1 = 0`);
          }
        }

        const result = await tx
          .update(metadataFiles)
          .set({
            ...update.data,
            updatedAt: new Date(),
          })
          .where(and(...whereConditions))
          .returning();


        if (result.length > 0) {
          count++;
        }
      }
      return count;
    });
  }

  async deleteMetadataFile(id: string, permissions: UserPermissions): Promise<boolean> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [eq(metadataFiles.id, id)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const result = await db
      .delete(metadataFiles)
      .where(and(...whereConditions))
      .returning();
    return result.length > 0;
  }

  async deleteMetadataBySeries(seriesTitle: string, permissions: UserPermissions): Promise<number> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      or(
        eq(metadataFiles.seriesTitle, seriesTitle),
        eq(metadataFiles.title, seriesTitle)
      )
    ];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const result = await db
      .delete(metadataFiles)
      .where(and(...whereConditions))
      .returning();
    return result.length;
  }

  async deleteMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<number> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      or(
        eq(metadataFiles.seriesTitle, seriesTitle),
        eq(metadataFiles.title, seriesTitle)
      ),
      eq(metadataFiles.season, season)
    ];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const result = await db
      .delete(metadataFiles)
      .where(and(...whereConditions))
      .returning();
    return result.length;
  }

  async createBatchMetadataFiles(batch: BatchCreate, permissions: UserPermissions): Promise<MetadataFile[]> {
    return await db.transaction(async (tx) => {
      // Collect existing IDs for collision avoidance within the batch
      const existingRows = await tx.select({ id: metadataFiles.id }).from(metadataFiles);
      const usedIds = new Set(existingRows.map(f => f.id));

      const generateUniqueId = (): string => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const candidate = formatMetadataId(Math.floor(Math.random() * 900000000) + 100000);
          if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
          }
        }
        throw new Error("Failed to generate unique ID");
      };

      // Normalize breakTimes array once for the batch
      const normalizedBreakTimes = (batch.breakTimes || [])
        .filter(t => t && typeof t === 'string' && t.trim())
        .map(t => t.trim());

      const normalizedBreakTime = normalizedBreakTimes.length > 0
        ? normalizedBreakTimes[0]
        : (batch.breakTime && batch.breakTime.trim() ? batch.breakTime.trim() : null);

      const finalBreakTimes = normalizedBreakTimes.length > 0
        ? normalizedBreakTimes
        : (normalizedBreakTime ? [normalizedBreakTime] : []);

      const files: (InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null })[] = [];
      for (let i = 0; i < batch.episodeCount; i++) {
        const fileData: InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null } = {
          id: generateUniqueId(),
          title: batch.title,
          season: batch.season,
          episode: batch.startEpisode + i,
          duration: (batch.duration || null) as any,
          breakTime: normalizedBreakTime,
          breakTimes: finalBreakTimes,
          endCredits: batch.endCredits,
          category: batch.category,
          seasonType: batch.seasonType,
          contentType: (batch.contentType || null) as any,
          description: batch.description,
          genre: batch.genre,
          actors: batch.actors,
          tags: [],
          channel: batch.channel,
          audioId: batch.audioId,
          seriesTitle: batch.seriesTitle,
          programRating: batch.programRating,
          productionCountry: batch.productionCountry,
          yearOfProduction: batch.yearOfProduction,
          catchUp: batch.catchUp,
          dateStart: batch.dateStart,
          dateEnd: batch.dateEnd,
          subtitles: batch.subtitles,
          segmented: batch.segmented,
          draft: batch.draft ?? 0,
          createdBy: permissions.user.id,
        };

        if (permissions.fileVisibility === "group" && permissions.groupIds && permissions.groupIds.length > 0) {
          fileData.groupId = permissions.groupIds[0];
        }

        files.push(fileData);
      }

      const created = await tx.insert(metadataFiles).values(files).returning();

      // Create tasks if description provided
      if (batch.taskDescription && created.length > 0) {
        const taskValues = created.map(file => ({
          metadataFileId: file.id,
          description: batch.taskDescription!,
          status: "pending" as const,
          createdBy: permissions.userId,
        }));
        await tx.insert(tasks).values(taskValues);
      }

      return created;
    });
  }

  async createMultiBatchMetadataFiles(data: { batches: EnhancedBatchCreate[], taskDescription?: string }, permissions: UserPermissions): Promise<MetadataFile[]> {
    return await db.transaction(async (tx) => {
      // Collect existing IDs for collision avoidance
      const existingRows = await tx.select({ id: metadataFiles.id }).from(metadataFiles);
      const usedIds = new Set(existingRows.map(f => f.id));

      const generateUniqueId = (): string => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const candidate = formatMetadataId(Math.floor(Math.random() * 900000000) + 100000);
          if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
          }
        }
        throw new Error("Failed to generate unique ID");
      };

      const allFiles: (InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null })[] = [];

      for (const batch of data.batches) {
        // Normalize breakTimes array once for the batch
        const normalizedBreakTimes = (batch.breakTimes || [])
          .filter(t => t && typeof t === 'string' && t.trim())
          .map(t => t.trim());

        const normalizedBreakTime = normalizedBreakTimes.length > 0
          ? normalizedBreakTimes[0]
          : (batch.breakTime && batch.breakTime.trim() ? batch.breakTime.trim() : null);

        const finalBreakTimes = normalizedBreakTimes.length > 0
          ? normalizedBreakTimes
          : (normalizedBreakTime ? [normalizedBreakTime] : []);

        for (const seasonConfig of batch.seasons) {
          for (let i = 0; i < seasonConfig.episodeCount; i++) {
            const fileData: InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null } = {
              id: generateUniqueId(),
              title: batch.title,
              season: seasonConfig.season,
              episode: seasonConfig.startEpisode + i,
              duration: (batch.duration || null) as any,
              breakTime: normalizedBreakTime,
              breakTimes: finalBreakTimes,
              endCredits: batch.endCredits,
              category: batch.category,
              seasonType: batch.seasonType,
              contentType: (batch.contentType || null) as any,
              description: batch.description,
              genre: batch.genre,
              actors: batch.actors,
              tags: [],
              channel: batch.channel,
              audioId: batch.audioId,
              seriesTitle: batch.seriesTitle,
              programRating: batch.programRating,
              productionCountry: batch.productionCountry,
              yearOfProduction: batch.yearOfProduction,
              catchUp: batch.catchUp,
              dateStart: batch.dateStart,
              dateEnd: batch.dateEnd,
              subtitles: batch.subtitles,
              segmented: batch.segmented,
              draft: batch.draft ?? 1,
              licenseId: batch.licenseId,
              googleDriveLink: batch.googleDriveLink,
              createdBy: permissions.user.id,
            };

            if (permissions.fileVisibility === "group" && permissions.groupIds && permissions.groupIds.length > 0) {
              fileData.groupId = permissions.groupIds[0];
            }

            allFiles.push(fileData);
          }
        }
      }

      const created = await tx.insert(metadataFiles).values(allFiles).returning();

      // If a task description was provided, create a task for each new file
      if (data.taskDescription && created.length > 0) {
        const taskValues = created.map(file => ({
          metadataFileId: file.id,
          description: data.taskDescription!,
          status: "pending" as const,
          createdBy: permissions.user.id,
        }));
        await tx.insert(tasks).values(taskValues);
      }

      return created;
    });
  }

  async getStats(permissions: UserPermissions): Promise<{
    totalFiles: number; recentFiles: number; totalSeries: number;
    overdueTasks: number; expiringLicenses: number; incompleteMeta: number; drafts: number;
  }> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions: any[] = [];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const totalFiles = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(metadataFiles)
      .where(whereClause);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentWhereConditions = [...whereConditions, gte(metadataFiles.createdAt, oneDayAgo)];
    const recentFiles = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(metadataFiles)
      .where(recentWhereConditions.length > 0 ? and(...recentWhereConditions) : gte(metadataFiles.createdAt, oneDayAgo));

    const uniqueSeries = await db
      .select({ count: sql<number>`count(distinct title)::int` })
      .from(metadataFiles)
      .where(whereClause);

    // Overdue tasks: pending or in_progress with deadline in the past
    const overdueTasks = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(
        sql`${tasks.status} != 'completed'`,
        sql`${tasks.deadline} IS NOT NULL`,
        sql`${tasks.deadline} < NOW()`
      ));

    // Licenses expiring within 30 days
    const expiringLicenses = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(licenses)
      .where(and(
        sql`${licenses.licenseEnd} IS NOT NULL`,
        sql`${licenses.licenseEnd} > NOW()`,
        sql`${licenses.licenseEnd} < NOW() + INTERVAL '30 days'`
      ));

    // Files with incomplete metadata or subs status
    const incompleteMeta = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(metadataFiles)
      .where(and(
        ...(whereConditions.length > 0 ? whereConditions : []),
        or(
          eq(metadataFiles.metadataTimesStatus, "Incomplete"),
          eq(metadataFiles.subsStatus, "Incomplete")
        )
      ));

    // Draft files
    const drafts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(metadataFiles)
      .where(and(
        ...(whereConditions.length > 0 ? whereConditions : []),
        eq(metadataFiles.draft, 1)
      ));

    return {
      totalFiles: totalFiles[0]?.count || 0,
      recentFiles: recentFiles[0]?.count || 0,
      totalSeries: uniqueSeries[0]?.count || 0,
      overdueTasks: overdueTasks[0]?.count || 0,
      expiringLicenses: expiringLicenses[0]?.count || 0,
      incompleteMeta: incompleteMeta[0]?.count || 0,
      drafts: drafts[0]?.count || 0,
    };
  }

  async getUserTags(userId: string, type: string): Promise<UserDefinedTag[]> {
    return await db
      .select()
      .from(userDefinedTags)
      .where(and(eq(userDefinedTags.userId, userId), eq(userDefinedTags.type, type)))
      .orderBy(desc(userDefinedTags.createdAt));
  }

  async createUserTag(data: InsertUserDefinedTag): Promise<UserDefinedTag> {
    const [created] = await db
      .insert(userDefinedTags)
      .values(data)
      .returning();
    return created;
  }

  async deleteUserTag(id: number, userId: string): Promise<void> {
    await db
      .delete(userDefinedTags)
      .where(and(eq(userDefinedTags.id, id), eq(userDefinedTags.userId, userId)));
  }

  async getMetadataBySeriesTitle(seriesTitle: string, permissions: UserPermissions): Promise<MetadataFile[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [eq(metadataFiles.title, seriesTitle)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const files = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions))
      .orderBy(metadataFiles.season, metadataFiles.episode);
    return files.map(file => normalizeMetadataFile(file));
  }

  async getMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<MetadataFile[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      eq(metadataFiles.title, seriesTitle),
      season === 0 ? sql`${metadataFiles.season} IS NULL OR ${metadataFiles.season} = 0` : eq(metadataFiles.season, season)
    ];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const files = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions))
      .orderBy(metadataFiles.episode);
    return files.map(file => normalizeMetadataFile(file));
  }

  async getAdjacentEpisodes(id: string, permissions: UserPermissions): Promise<{ prev: MetadataFile | null; next: MetadataFile | null }> {
    const currentFile = await this.getMetadataFile(id, permissions);
    if (!currentFile || !currentFile.season || !currentFile.episode) {
      return { prev: null, next: null };
    }

    const visibility = getFileVisibilityConditions(permissions);
    const baseConditions = [
      eq(metadataFiles.title, currentFile.title),
      eq(metadataFiles.season, currentFile.season),
    ];

    if (visibility.type === "own") {
      baseConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        baseConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        baseConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        baseConditions.push(sql`1 = 0`);
      }
    }

    const [prevFile] = await db
      .select()
      .from(metadataFiles)
      .where(
        and(
          ...baseConditions,
          sql`${metadataFiles.episode} < ${currentFile.episode}`
        )
      )
      .orderBy(desc(metadataFiles.episode))
      .limit(1);

    const [nextFile] = await db
      .select()
      .from(metadataFiles)
      .where(
        and(
          ...baseConditions,
          sql`${metadataFiles.episode} > ${currentFile.episode}`
        )
      )
      .orderBy(metadataFiles.episode)
      .limit(1);

    return {
      prev: prevFile ? normalizeMetadataFile(prevFile) : null,
      next: nextFile ? normalizeMetadataFile(nextFile) : null,
    };
  }

  async searchMetadata(keyword: string, permissions: UserPermissions): Promise<MetadataFile[]> {
    const pattern = `%${escapeLike(keyword.trim())}%`;
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      or(
        sql`LOWER(${metadataFiles.title}) LIKE LOWER(${pattern}) ESCAPE '\\'`,
        sql`LOWER(${metadataFiles.seriesTitle}) LIKE LOWER(${pattern}) ESCAPE '\\'`
      )
    ];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const files = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions))
      .orderBy(metadataFiles.title, metadataFiles.season, metadataFiles.episode)
      .limit(100);
    return files.map(file => normalizeMetadataFile(file));
  }

  async searchLicenses(keyword: string): Promise<License[]> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return [];
    }

    const licensePattern = `%${escapeLike(trimmed)}%`;
    return await db
      .select()
      .from(licenses)
      .where(
        or(
          sql`LOWER(${licenses.name}) LIKE LOWER(${licensePattern}) ESCAPE '\\'`,
          sql`LOWER(${licenses.distributor}) LIKE LOWER(${licensePattern}) ESCAPE '\\'`,
          sql`LOWER(${licenses.contentTitle}) LIKE LOWER(${licensePattern}) ESCAPE '\\'`
        )
      )
      .orderBy(desc(licenses.createdAt))
      .limit(50);
  }

  async searchTasks(keyword: string, permissions: UserPermissions): Promise<(Task & { metadataFile: MetadataFile })[]> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return [];
    }

    const taskPattern = `%${escapeLike(trimmed)}%`;
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      or(
        sql`LOWER(${tasks.description}) LIKE LOWER(${taskPattern}) ESCAPE '\\'`,
        sql`LOWER(${metadataFiles.title}) LIKE LOWER(${taskPattern}) ESCAPE '\\'`,
        sql`LOWER(${metadataFiles.seriesTitle}) LIKE LOWER(${taskPattern}) ESCAPE '\\'`
      )
    ];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const results = await db
      .select({
        task: tasks,
        metadataFile: metadataFiles,
      })
      .from(tasks)
      .innerJoin(metadataFiles, eq(tasks.metadataFileId, metadataFiles.id))
      .where(and(...whereConditions))
      .orderBy(desc(tasks.createdAt))
      .limit(100);

    return results.map(r => ({
      ...r.task,
      metadataFile: normalizeMetadataFile(r.metadataFile),
    }));
  }

  async globalSearch(query: string, permissions: UserPermissions): Promise<{
    metadata: MetadataFileWithLicenses[];
    licenses: License[];
    series: Series[];
  }> {
    const trimmed = query.trim();
    if (!trimmed) return { metadata: [], licenses: [], series: [] };

    const pattern = `%${escapeLike(trimmed)}%`;
    const visibility = getFileVisibilityConditions(permissions);
    const metaWhere: any[] = [
      or(
        sql`LOWER(${metadataFiles.title}) LIKE LOWER(${pattern}) ESCAPE '\\'`,
        sql`LOWER(${metadataFiles.episodeTitle}) LIKE LOWER(${pattern}) ESCAPE '\\'`,
        sql`${metadataFiles.id} LIKE ${pattern} ESCAPE '\\'`
      )
    ];
    if (visibility.type === "own") {
      metaWhere.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        metaWhere.push(inArray(metadataFiles.groupId, visibility.groupIds));
      } else {
        metaWhere.push(sql`1 = 0`);
      }
    }

    const [metadataResults, licenseResults, seriesResults] = await Promise.all([
      db.select().from(metadataFiles)
        .where(and(...metaWhere))
        .orderBy(desc(metadataFiles.createdAt))
        .limit(5),
      db.select().from(licenses)
        .where(or(
          sql`LOWER(${licenses.name}) LIKE LOWER(${pattern}) ESCAPE '\\'`,
          sql`LOWER(${licenses.distributor}) LIKE LOWER(${pattern}) ESCAPE '\\'`,
          sql`LOWER(${licenses.contentTitle}) LIKE LOWER(${pattern}) ESCAPE '\\'`
        ))
        .orderBy(desc(licenses.createdAt))
        .limit(5),
      db.select().from(seriesTable)
        .where(sql`LOWER(${seriesTable.title}) LIKE LOWER(${pattern}) ESCAPE '\\'`)
        .orderBy(desc(seriesTable.createdAt))
        .limit(5),
    ]);

    return {
      metadata: metadataResults.map(f => normalizeMetadataFile(f)),
      licenses: licenseResults,
      series: seriesResults,
    };
  }

  async listAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        isAdmin: isAdmin ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserStatus(userId: string, status: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserPermissions(userId: string, permissions: {
    canReadMetadata: number,
    canWriteMetadata: number,
    canReadLicenses: number,
    canWriteLicenses: number,
    canReadTasks: number,
    canWriteTasks: number,
    canUseAI: number,
    canUseAIChat: number
  }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        ...permissions,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        password: passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserVisibility(userId: string, fileVisibility: string): Promise<User | undefined> {
    const allowed = ["own", "all", "group"];
    if (!allowed.includes(fileVisibility)) {
      throw new Error(`Invalid fileVisibility value: "${fileVisibility}". Must be one of: ${allowed.join(", ")}.`);
    }
    const [updated] = await db
      .update(users)
      .set({
        fileVisibility,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserGroups(userId: string, groupIds: string[]): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        groupIds,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserProfile(userId: string, data: Partial<User>): Promise<User | undefined> {
    // Whitelist only safe profile fields to prevent privilege escalation
    const safeData: Record<string, unknown> = {};
    if (data.firstName !== undefined) safeData.firstName = data.firstName;
    if (data.lastName !== undefined) safeData.lastName = data.lastName;
    if (data.profileImageUrl !== undefined) safeData.profileImageUrl = data.profileImageUrl;

    const [updated] = await db
      .update(users)
      .set({
        ...safeData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
    return result.length > 0;
  }

  async getUsersByGroupId(groupId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(sql`${groupId} = ANY(${users.groupIds})`);
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [created] = await db
      .insert(groups)
      .values(group)
      .returning();
    return created;
  }

  async getAllGroups(): Promise<Group[]> {
    return await db
      .select()
      .from(groups)
      .orderBy(groups.name);
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const result = await db
      .delete(groups)
      .where(eq(groups.id, groupId))
      .returning();
    return result.length > 0;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const [created] = await db.insert(licenses).values(license).returning();
    return created;
  }

  async getLicense(id: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license;
  }

  async listLicenses(): Promise<License[]> {
    return await db.select().from(licenses).orderBy(desc(licenses.createdAt));
  }

  async updateLicense(id: string, data: Partial<InsertLicense>): Promise<License | undefined> {
    const [updated] = await db
      .update(licenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(licenses.id, id))
      .returning();
    return updated;
  }

  async deleteLicense(id: string): Promise<boolean> {
    const result = await db.delete(licenses).where(eq(licenses.id, id)).returning();
    return result.length > 0;
  }

  async generateLicenseDrafts(data: LicenseBatchGenerate, userId: string): Promise<MetadataFile[]> {
    return await db.transaction(async (tx) => {
      const existingRows = await tx.select({ id: metadataFiles.id }).from(metadataFiles);
      const usedIds = new Set(existingRows.map(f => f.id));

      const generateUniqueId = (): string => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const candidate = formatMetadataId(Math.floor(Math.random() * 900000000) + 100000);
          if (!usedIds.has(candidate)) {
            usedIds.add(candidate);
            return candidate;
          }
        }
        throw new Error("Failed to generate unique ID");
      };

      const files: any[] = [];
      const { licenseId, seriesTitle, seasonStart, seasonEnd, episodesPerSeason } = data;

      for (let season = seasonStart; season <= seasonEnd; season++) {
        for (let episode = 1; episode <= episodesPerSeason; episode++) {
          files.push({
            id: generateUniqueId(),
            title: seriesTitle,
            season: season,
            episode: episode,
            licenseId: licenseId,
            draft: 1,
            createdBy: userId,
            duration: "00:00:00",
            contentType: "Long Form",
            breakTimes: [],
            tags: [],
          });
        }
      }

      const created = await tx.insert(metadataFiles).values(files).returning();
      return created;
    });
  }

  async createTask(taskData: InsertTask & { createdBy: string }): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async bulkCreateTasks(taskData: { metadataFileIds: string[], description: string, deadline?: Date | null, assignedTo?: string, priority?: string, createdBy: string }): Promise<Task[]> {
    const { metadataFileIds, description, deadline, assignedTo, priority, createdBy } = taskData;
    if (metadataFileIds.length === 0) return [];

    const values = metadataFileIds.map(fileId => ({
      metadataFileId: fileId,
      description,
      status: "pending" as const,
      deadline,
      assignedTo: assignedTo || null,
      priority: priority || "medium",
      createdBy,
    }));

    return await db.insert(tasks).values(values).returning();
  }

  async listTasks(permissions: UserPermissions, status?: string, assignedTo?: string): Promise<(Task & { metadataFile: MetadataFile })[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
        whereConditions.push(sql`${metadataFiles.groupId} IS NOT NULL`);
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    if (status) {
      whereConditions.push(eq(tasks.status, status));
    }

    if (assignedTo) {
      whereConditions.push(eq(tasks.assignedTo, assignedTo));
    }

    const results = await db
      .select({
        task: tasks,
        metadataFile: metadataFiles,
      })
      .from(tasks)
      .innerJoin(metadataFiles, eq(tasks.metadataFileId, metadataFiles.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(tasks.createdAt));

    return results.map(r => ({
      ...r.task,
      metadataFile: normalizeMetadataFile(r.metadataFile)
    }));
  }

  async getTasksByFileId(fileId: string, permissions: UserPermissions): Promise<Task[]> {
    // Basic visibility check for the file itself is handled by the route or here
    // Let's assume the route ensures the user has access to this fileId
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.metadataFileId, fileId))
      .orderBy(desc(tasks.createdAt));
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  async bulkDeleteTasks(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const result = await db.delete(tasks).where(inArray(tasks.id, ids)).returning();
    return result.length > 0;
  }

  // Series Management
  async getSeriesById(id: string): Promise<Series | undefined> {
    const [item] = await db.select().from(seriesTable).where(eq(seriesTable.id, id));
    return item;
  }

  async getSeriesByTitle(title: string): Promise<Series | undefined> {
    const [item] = await db.select().from(seriesTable).where(eq(seriesTable.title, title));
    return item;
  }

  async getAllSeries(): Promise<Series[]> {
    return await db.select().from(seriesTable).orderBy(seriesTable.title);
  }

  async upsertSeries(data: InsertSeries): Promise<Series> {
    const [item] = await db
      .insert(seriesTable)
      .values(data)
      .onConflictDoUpdate({
        target: seriesTable.title,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return item;
  }

  async updateSeries(id: string, data: Partial<InsertSeries>): Promise<Series | undefined> {
    const [updated] = await db
      .update(seriesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(seriesTable.id, id))
      .returning();
    return updated;
  }

  async deleteSeries(id: string): Promise<boolean> {
    const result = await db.delete(seriesTable).where(eq(seriesTable.id, id)).returning();
    return result.length > 0;
  }

  async linkSeriesToLicense(seriesId: string, licenseId: string, seasonRange?: string): Promise<void> {
    await db
      .insert(seriesToLicenses)
      .values({ seriesId, licenseId, seasonRange })
      .onConflictDoUpdate({
        target: [seriesToLicenses.seriesId, seriesToLicenses.licenseId],
        set: { seasonRange },
      });
  }

  async unlinkSeriesFromLicense(seriesId: string, licenseId: string): Promise<void> {
    await db
      .delete(seriesToLicenses)
      .where(and(eq(seriesToLicenses.seriesId, seriesId), eq(seriesToLicenses.licenseId, licenseId)));
  }

  async getSeriesLicenses(seriesId: string): Promise<(License & { seasonRange: string | null })[]> {
    const results = await db
      .select({
        license: licenses,
        seasonRange: seriesToLicenses.seasonRange,
      })
      .from(seriesToLicenses)
      .innerJoin(licenses, eq(seriesToLicenses.licenseId, licenses.id))
      .where(eq(seriesToLicenses.seriesId, seriesId));

    return results.map(r => ({
      ...r.license,
      seasonRange: r.seasonRange,
    }));
  }

  async getSeriesLicensesFromEpisodes(seriesId: string): Promise<(License & { seasonRange: string | null })[]> {
    // Derive licenses from episode-level links (metadataToLicenses join table)
    const results = await db
      .select({
        license: licenses,
        season: metadataFiles.season,
      })
      .from(metadataToLicenses)
      .innerJoin(metadataFiles, eq(metadataToLicenses.metadataFileId, metadataFiles.id))
      .innerJoin(licenses, eq(metadataToLicenses.licenseId, licenses.id))
      .where(eq(metadataFiles.seriesId, seriesId));

    // Group by license and compute season ranges
    const licenseMap = new Map<string, { license: License; seasons: Set<number> }>();
    for (const r of results) {
      if (!licenseMap.has(r.license.id)) {
        licenseMap.set(r.license.id, { license: r.license, seasons: new Set() });
      }
      if (r.season != null) {
        licenseMap.get(r.license.id)!.seasons.add(r.season);
      }
    }

    // Also include any manually linked series-level licenses (seriesToLicenses)
    const manualLinks = await this.getSeriesLicenses(seriesId);
    for (const ml of manualLinks) {
      if (!licenseMap.has(ml.id)) {
        licenseMap.set(ml.id, { license: ml, seasons: new Set() });
      }
    }

    return Array.from(licenseMap.values()).map(({ license, seasons }) => {
      const sortedSeasons = Array.from(seasons).sort((a, b) => a - b);
      const seasonRange = sortedSeasons.length > 0 ? compactSeasonRange(sortedSeasons) : null;
      return { ...license, seasonRange };
    });
  }

  async linkMetadataToLicense(licenseId: string, metadataIds: string[]): Promise<number> {
    if (metadataIds.length === 0) return 0;
    const values = metadataIds.map(id => ({ metadataFileId: id, licenseId }));
    await db.insert(metadataToLicenses).values(values).onConflictDoNothing();

    // Auto-sync: update seriesToLicenses for any series these files belong to
    const files = await db.select({ seriesId: metadataFiles.seriesId })
      .from(metadataFiles)
      .where(inArray(metadataFiles.id, metadataIds));
    const seriesIds = Array.from(new Set(files.map(f => f.seriesId).filter(Boolean))) as string[];
    for (const sid of seriesIds) {
      await this.linkSeriesToLicense(sid, licenseId);
    }

    return metadataIds.length;
  }

  async unlinkMetadataFromLicense(licenseId: string, metadataIds: string[]): Promise<number> {
    if (metadataIds.length === 0) return 0;
    await db.delete(metadataToLicenses).where(
      and(
        eq(metadataToLicenses.licenseId, licenseId),
        inArray(metadataToLicenses.metadataFileId, metadataIds)
      )
    );
    return metadataIds.length;
  }

  async getSeriesTasks(seriesId: string, permissions: UserPermissions): Promise<(Task & { metadataFile: MetadataFileWithLicenses })[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [eq(metadataFiles.seriesId, seriesId)];

    if (visibility.type === "own") {
      whereConditions.push(eq(metadataFiles.createdBy, visibility.userId));
    } else if (visibility.type === "group") {
      if (visibility.groupIds && visibility.groupIds.length > 0) {
        whereConditions.push(inArray(metadataFiles.groupId, visibility.groupIds));
      } else {
        whereConditions.push(sql`1 = 0`);
      }
    }

    const results = await db
      .select({
        task: tasks,
        metadataFile: metadataFiles,
      })
      .from(tasks)
      .innerJoin(metadataFiles, eq(tasks.metadataFileId, metadataFiles.id))
      .where(and(...whereConditions))
      .orderBy(desc(tasks.createdAt));

    return results.map(r => ({
      ...r.task,
      metadataFile: normalizeMetadataFile(r.metadataFile)
    }));
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const [setting] = await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return setting;
  }

  async getSettingsByKeys(keys: string[]): Promise<Setting[]> {
    if (keys.length === 0) return [];
    return await db.select().from(settings).where(inArray(settings.key, keys));
  }
  // --- Contract Management ---

  async listContracts(): Promise<(Contract & { licenseCount: number; totalCost: number })[]> {
    const allContracts = await db.select().from(contracts).orderBy(contracts.distributor, contracts.name);

    const results = [];
    for (const contract of allContracts) {
      const links = await db
        .select({ licenseId: contractsToLicenses.licenseId })
        .from(contractsToLicenses)
        .where(eq(contractsToLicenses.contractId, contract.id));

      let totalCost = 0;
      if (links.length > 0) {
        const linkedLicenses = await db
          .select({ amount: licenses.licenseFeeAmount })
          .from(licenses)
          .where(inArray(licenses.id, links.map(l => l.licenseId)));
        totalCost = linkedLicenses.reduce((sum, l) => {
          const amt = l.amount ? parseFloat(l.amount) : 0;
          return sum + (isNaN(amt) ? 0 : amt);
        }, 0);
      }

      results.push({ ...contract, licenseCount: links.length, totalCost });
    }
    return results;
  }

  async getContract(id: string): Promise<(Contract & { licenses: License[] }) | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contract) return undefined;

    const links = await db
      .select({ licenseId: contractsToLicenses.licenseId })
      .from(contractsToLicenses)
      .where(eq(contractsToLicenses.contractId, id));

    const linkedLicenses = links.length > 0
      ? await db.select().from(licenses).where(inArray(licenses.id, links.map(l => l.licenseId)))
      : [];

    return { ...contract, licenses: linkedLicenses };
  }

  async createContract(data: InsertContract & { createdBy: string }): Promise<Contract> {
    const [created] = await db.insert(contracts).values(data).returning();
    return created;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [updated] = await db.update(contracts).set({ ...data, updatedAt: new Date() }).where(eq(contracts.id, id)).returning();
    return updated;
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  async linkContractToLicense(contractId: string, licenseId: string): Promise<void> {
    await db.insert(contractsToLicenses).values({ contractId, licenseId }).onConflictDoNothing();
  }

  async unlinkContractFromLicense(contractId: string, licenseId: string): Promise<void> {
    await db.delete(contractsToLicenses).where(
      and(eq(contractsToLicenses.contractId, contractId), eq(contractsToLicenses.licenseId, licenseId))
    );
  }
}

export const storage = new DatabaseStorage();
