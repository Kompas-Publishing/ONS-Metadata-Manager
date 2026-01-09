import { storage } from "./storage";
import type { User } from "../shared/schema";

export interface UserPermissions {
  user: User;
  isAdmin: boolean;
  isActive: boolean;
  canRead: boolean;
  canWrite: boolean;
  canEdit: boolean;
  canDelete: boolean;
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
  const isPending = user.status === "pending";
  const isArchived = user.status === "archived";

  return {
    user,
    isAdmin,
    isActive,
    canRead: isAdmin || (isActive && user.canRead === 1),
    canWrite: isAdmin || (isActive && user.canWrite === 1),
    canEdit: isAdmin || (isActive && user.canEdit === 1),
    canDelete: isAdmin,
    fileVisibility: user.fileVisibility as "own" | "all" | "group",
    groupIds: user.groupIds || [],
  };
}

export async function requirePermission(
  userId: string, 
  permission: "read" | "write" | "edit" | "delete"
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

  const permissionMap = {
    read: permissions.canRead,
    write: permissions.canWrite,
    edit: permissions.canEdit,
    delete: permissions.canDelete,
  };

  const allowed = permissionMap[permission];
  
  return {
    allowed,
    permissions,
    reason: allowed ? undefined : `No ${permission} permission`
  };
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
