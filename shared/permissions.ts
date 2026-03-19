import { storage } from "./storage.js";
import type { User } from "./schema.js";

export interface UserPermissions {
  user: User;
  userId: string;
  isAdmin: boolean;
  isActive: boolean;
  features: {
    metadata: { read: boolean; write: boolean };
    licenses: { read: boolean; write: boolean };
    tasks: { read: boolean; write: boolean };
    ai: boolean;
    aiChat: boolean;
  };
  fileVisibility: "own" | "all" | "group";
  groupIds: string[];
}

export async function getUserPermissions(userId: string): Promise<UserPermissions | null> {
  const user = await storage.getUser(userId);

  if (!user) {
    return null;
  }

  const isAdmin = user.isAdmin === 1;
  const isActive = user.status === "active";

  return {
    user,
    userId,
    isAdmin,
    isActive,
    features: {
      metadata: {
        read: isAdmin || (isActive && user.canReadMetadata === 1),
        write: isAdmin || (isActive && user.canWriteMetadata === 1),
      },
      licenses: {
        read: isAdmin || (isActive && user.canReadLicenses === 1),
        write: isAdmin || (isActive && user.canWriteLicenses === 1),
      },
      tasks: {
        read: isAdmin || (isActive && user.canReadTasks === 1),
        write: isAdmin || (isActive && user.canWriteTasks === 1),
      },
      ai: isAdmin || (isActive && user.canUseAI === 1),
      aiChat: isAdmin || (isActive && user.canUseAIChat === 1),
    },
    fileVisibility: user.fileVisibility as "own" | "all" | "group",
    groupIds: user.groupIds || [],
  };
}

export type PermissionFeature = "metadata" | "licenses" | "tasks" | "ai" | "aiChat";
export type PermissionAction = "read" | "write";

export async function requirePermission(
  userId: string,
  feature: PermissionFeature,
  action: PermissionAction = "read"
): Promise<{ allowed: boolean; permissions: UserPermissions | null; reason?: string }> {
  const permissions = await getUserPermissions(userId);

  if (!permissions) {
    return { allowed: false, permissions: null, reason: "User not found" };
  }

  if (permissions.user.status === "archived") {
    return { allowed: false, permissions, reason: "Account is archived" };
  }

  if (permissions.user.status === "pending") {
    return { allowed: false, permissions, reason: "Account pending approval" };
  }

  let allowed = false;
  if (feature === "ai") {
    allowed = permissions.features.ai;
  } else if (feature === "aiChat") {
    allowed = permissions.features.aiChat;
  } else {
    allowed = permissions.features[feature][action];
  }

  return {
    allowed,
    permissions,
    reason: allowed ? undefined : `No ${action} permission for ${feature}`
  };
}

/**
 * Validates that a URL belongs to Vercel Blob storage.
 * This prevents SSRF attacks where a malicious URL could be used to leak sensitive tokens.
 */
const BLOB_STORE_ID = process.env.BLOB_STORE_ID || "rwcuq3rxnmz4nbvx";

export function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    // Pentest Fix (Ultra-Strict): Exact match for our specific store hostnames.
    // This is the most robust way to prevent SSRF and token leakage.
    return (
      hostname === `${BLOB_STORE_ID}.public.blob.vercel-storage.com` ||
      hostname === `${BLOB_STORE_ID}.private.blob.vercel-storage.com`
    );
  } catch {
    return false;
  }
}

export function getFileVisibilityConditions(permissions: UserPermissions) {
  if (permissions.isAdmin) {
    return {
      type: "all" as const,
      userId: permissions.user.id,
      groupId: null,
    };
  }

  if (permissions.fileVisibility === "all") {
    return {
      type: "all" as const,
      userId: permissions.user.id,
      groupId: null,
    };
  }

  if (permissions.fileVisibility === "group") {
    return {
      type: "group" as const,
      userId: permissions.user.id,
      groupIds: permissions.groupIds,
    };
  }

  return {
    type: "own" as const,
    userId: permissions.user.id,
    groupId: null,
  };
}
