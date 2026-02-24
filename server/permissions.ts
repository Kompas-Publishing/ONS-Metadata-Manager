import { storage } from "./storage";
import type { User } from "@shared/schema";

export interface UserPermissions {
  user: User;
  isAdmin: boolean;
  isActive: boolean;
  permissions: {
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
    isAdmin,
    isActive,
    permissions: {
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
    allowed = permissions.permissions.ai;
  } else if (feature === "aiChat") {
    allowed = permissions.permissions.aiChat;
  } else {
    allowed = permissions.permissions[feature][action];
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
export function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    
    const hostname = parsed.hostname;
    // Pentest Fix (Refined): Allow any legitimate Vercel Blob storage subdomain.
    // This includes both .public.blob.vercel-storage.com and .blob.vercel-storage.com (for private blobs).
    return (
      hostname === "blob.vercel-storage.com" ||
      hostname.endsWith(".blob.vercel-storage.com")
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
