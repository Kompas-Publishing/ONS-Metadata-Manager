import {
  users,
  metadataFiles,
  settings,
  userDefinedTags,
  groups,
  type User,
  type UpsertUser,
  type MetadataFile,
  type InsertMetadataFile,
  type BatchCreate,
  type Setting,
  type UserDefinedTag,
  type InsertUserDefinedTag,
  type Group,
  type InsertGroup,
} from "@shared/schema";
import { db } from "./db.js";
import { eq, desc, sql, gte, and, inArray, or } from "drizzle-orm";
import { UserPermissions, getFileVisibilityConditions } from "./permissions.js";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  peekNextId(): Promise<string>;
  consumeNextId(): Promise<string>;
  getMetadataFile(id: string, permissions: UserPermissions): Promise<MetadataFile | undefined>;
  getMetadataByIds(ids: string[], permissions: UserPermissions): Promise<MetadataFile[]>;
  getAllMetadataFiles(permissions: UserPermissions): Promise<MetadataFile[]>;
  getRecentMetadataFiles(limit: number, permissions: UserPermissions): Promise<MetadataFile[]>;
  createMetadataFile(file: InsertMetadataFile, id: string, permissions: UserPermissions): Promise<MetadataFile>;
  updateMetadataFile(id: string, file: InsertMetadataFile, permissions: UserPermissions): Promise<MetadataFile | undefined>;
  bulkUpdateMetadata(updates: Array<{id: string, data: Partial<InsertMetadataFile>}>, permissions: UserPermissions): Promise<number>;
  deleteMetadataFile(id: string, permissions: UserPermissions): Promise<boolean>;
  createBatchMetadataFiles(batch: BatchCreate, permissions: UserPermissions): Promise<MetadataFile[]>;
  getStats(permissions: UserPermissions): Promise<{ totalFiles: number; recentFiles: number; totalSeries: number }>;
  getMetadataBySeriesTitle(seriesTitle: string, permissions: UserPermissions): Promise<MetadataFile[]>;
  getMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<MetadataFile[]>;
  getAdjacentEpisodes(id: string, permissions: UserPermissions): Promise<{ prev: MetadataFile | null; next: MetadataFile | null }>;
  
  getUserTags(userId: string, type: string): Promise<UserDefinedTag[]>;
  createUserTag(data: InsertUserDefinedTag): Promise<UserDefinedTag>;
  deleteUserTag(id: number, userId: string): Promise<void>;
  
  listAllUsers(): Promise<User[]>;
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined>;
  updateUserStatus(userId: string, status: string): Promise<User | undefined>;
  updateUserPermissions(userId: string, permissions: {canRead: number, canWrite: number, canEdit: number}): Promise<User | undefined>;
  updateUserVisibility(userId: string, fileVisibility: string): Promise<User | undefined>;
  updateUserGroups(userId: string, groupIds: string[]): Promise<User | undefined>;
  deleteUser(userId: string): Promise<boolean>;
  getUsersByGroupId(groupId: string): Promise<User[]>;
  
  createGroup(group: InsertGroup): Promise<Group>;
  getAllGroups(): Promise<Group[]>;
  deleteGroup(groupId: string): Promise<boolean>;
}

function formatMetadataId(num: number): string {
  const segment3 = String(num % 1000).padStart(3, '0');
  const segment2 = String(Math.floor(num / 1000) % 1000).padStart(3, '0');
  const segment1 = String(Math.floor(num / 1000000) % 1000).padStart(3, '0');
  return `${segment1}-${segment2}-${segment3}`;
}

function normalizeMetadataFile(file: MetadataFile): MetadataFile {
  // Normalize breakTimes and ensure breakTime is synced
  const breakTimes = file.breakTimes || (file.breakTime ? [file.breakTime] : []);
  const breakTime = breakTimes.length > 0 ? breakTimes[0] : file.breakTime;
  
  return {
    ...file,
    breakTime,
    breakTimes,
  };
}

export class DatabaseStorage implements IStorage {
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
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "next_id"));
    
    let nextId = 77362;
    if (setting) {
      nextId = parseInt(setting.value);
    } else {
      await db.insert(settings).values({
        key: "next_id",
        value: nextId.toString(),
      });
    }

    return formatMetadataId(nextId);
  }

  async consumeNextId(): Promise<string> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "next_id"));
    
    let nextId = 77362;
    if (setting) {
      nextId = parseInt(setting.value);
    } else {
      await db.insert(settings).values({
        key: "next_id",
        value: nextId.toString(),
      });
    }

    await db
      .update(settings)
      .set({
        value: (nextId + 1).toString(),
        updatedAt: new Date(),
      })
      .where(eq(settings.key, "next_id"));

    return formatMetadataId(nextId);
  }

  async getMetadataFile(id: string, permissions: UserPermissions): Promise<MetadataFile | undefined> {
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
    
    const [file] = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions));
    return file ? normalizeMetadataFile(file) : undefined;
  }

  async getMetadataByIds(ids: string[], permissions: UserPermissions): Promise<MetadataFile[]> {
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
    
    const files = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions));
    return files.map(normalizeMetadataFile);
  }

  async getAllMetadataFiles(permissions: UserPermissions): Promise<MetadataFile[]> {
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
    
    const files = await db
      .select()
      .from(metadataFiles)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(metadataFiles.createdAt));
    return files.map(normalizeMetadataFile);
  }

  async getRecentMetadataFiles(limit: number, permissions: UserPermissions): Promise<MetadataFile[]> {
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
    
    const files = await db
      .select()
      .from(metadataFiles)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(metadataFiles.createdAt))
      .limit(limit);
    return files.map(normalizeMetadataFile);
  }

  async createMetadataFile(file: InsertMetadataFile, id: string, permissions: UserPermissions): Promise<MetadataFile> {
    // Normalize breakTimes array - filter empty strings and trim
    const normalizedBreakTimes = (file.breakTimes || [])
      .filter(t => t && typeof t === 'string' && t.trim())
      .map(t => t.trim());
    
    // Compute breakTime from normalized breakTimes, or use provided breakTime
    const normalizedBreakTime = normalizedBreakTimes.length > 0 
      ? normalizedBreakTimes[0] 
      : (file.breakTime && file.breakTime.trim() ? file.breakTime.trim() : null);
    
    // Ensure breakTimes is populated from breakTime if empty
    const finalBreakTimes = normalizedBreakTimes.length > 0 
      ? normalizedBreakTimes 
      : (normalizedBreakTime ? [normalizedBreakTime] : []);
    
    const fileData: InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null } = {
      ...file,
      breakTime: normalizedBreakTime,
      breakTimes: finalBreakTimes,
      id,
      createdBy: permissions.user.id,
    };
    
    if (permissions.fileVisibility === "group" && permissions.groupIds && permissions.groupIds.length > 0) {
      fileData.groupId = permissions.groupIds[0];
    }
    
    const [created] = await db
      .insert(metadataFiles)
      .values(fileData)
      .returning();
    return created;
  }

  async updateMetadataFile(id: string, file: Partial<InsertMetadataFile>, permissions: UserPermissions): Promise<MetadataFile | undefined> {
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
    
    // Normalize breakTimes array - filter empty strings and trim
    const normalizedBreakTimes = (file.breakTimes || [])
      .filter(t => t && typeof t === 'string' && t.trim())
      .map(t => t.trim());
    
    // Compute breakTime from normalized breakTimes, or use provided breakTime
    const normalizedBreakTime = normalizedBreakTimes.length > 0 
      ? normalizedBreakTimes[0] 
      : (file.breakTime && file.breakTime.trim() ? file.breakTime.trim() : null);
    
    // Ensure breakTimes is populated from breakTime if empty
    const finalBreakTimes = normalizedBreakTimes.length > 0 
      ? normalizedBreakTimes 
      : (normalizedBreakTime ? [normalizedBreakTime] : []);
    
    const [updated] = await db
      .update(metadataFiles)
      .set({
        ...file,
        breakTime: normalizedBreakTime,
        breakTimes: finalBreakTimes,
        updatedAt: new Date(),
      })
      .where(and(...whereConditions))
      .returning();
    return updated;
  }

  async bulkUpdateMetadata(updates: Array<{id: string, data: Partial<InsertMetadataFile>}>, permissions: UserPermissions): Promise<number> {
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

  async createBatchMetadataFiles(batch: BatchCreate, permissions: UserPermissions): Promise<MetadataFile[]> {
    return await db.transaction(async (tx) => {
      const [setting] = await tx
        .select()
        .from(settings)
        .where(eq(settings.key, "next_id"));
      
      let currentId = 77362;
      if (setting) {
        currentId = parseInt(setting.value);
      } else {
        await tx.insert(settings).values({
          key: "next_id",
          value: currentId.toString(),
        });
      }

      // Normalize breakTimes array once for the batch - filter empty strings and trim
      const normalizedBreakTimes = (batch.breakTimes || [])
        .filter(t => t && typeof t === 'string' && t.trim())
        .map(t => t.trim());
      
      // Compute breakTime from normalized breakTimes, or use provided breakTime
      const normalizedBreakTime = normalizedBreakTimes.length > 0 
        ? normalizedBreakTimes[0] 
        : (batch.breakTime && batch.breakTime.trim() ? batch.breakTime.trim() : null);
      
      // Ensure breakTimes is populated from breakTime if empty
      const finalBreakTimes = normalizedBreakTimes.length > 0 
        ? normalizedBreakTimes 
        : (normalizedBreakTime ? [normalizedBreakTime] : []);

      const files: (InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null })[] = [];
      for (let i = 0; i < batch.episodeCount; i++) {
        const fileData: InsertMetadataFile & { id: string; createdBy: string; groupId?: string | null } = {
          id: formatMetadataId(currentId),
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
          createdBy: permissions.user.id,
        };
        
        if (permissions.fileVisibility === "group" && permissions.groupIds && permissions.groupIds.length > 0) {
          fileData.groupId = permissions.groupIds[0];
        }
        
        files.push(fileData);
        currentId++;
      }

      await tx
        .update(settings)
        .set({
          value: currentId.toString(),
          updatedAt: new Date(),
        })
        .where(eq(settings.key, "next_id"));

      const created = await tx.insert(metadataFiles).values(files).returning();
      return created;
    });
  }

  async getStats(permissions: UserPermissions): Promise<{ totalFiles: number; recentFiles: number; totalSeries: number }> {
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

    return {
      totalFiles: totalFiles[0]?.count || 0,
      recentFiles: recentFiles[0]?.count || 0,
      totalSeries: uniqueSeries[0]?.count || 0,
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
    return files.map(normalizeMetadataFile);
  }

  async getMetadataBySeason(seriesTitle: string, season: number, permissions: UserPermissions): Promise<MetadataFile[]> {
    const visibility = getFileVisibilityConditions(permissions);
    const whereConditions = [
      eq(metadataFiles.title, seriesTitle),
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
    
    const files = await db
      .select()
      .from(metadataFiles)
      .where(and(...whereConditions))
      .orderBy(metadataFiles.episode);
    return files.map(normalizeMetadataFile);
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

  async updateUserPermissions(userId: string, permissions: {canRead: number, canWrite: number, canEdit: number}): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        canRead: permissions.canRead,
        canWrite: permissions.canWrite,
        canEdit: permissions.canEdit,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserVisibility(userId: string, fileVisibility: string): Promise<User | undefined> {
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
}

export const storage = new DatabaseStorage();
