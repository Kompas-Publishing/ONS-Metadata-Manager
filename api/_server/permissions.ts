import { storage } from "./storage.js";
import type { UserPermissions, PermissionFeature, PermissionAction } from "../_shared/types.js";

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
    },
    fileVisibility: user.fileVisibility as "own" | "all" | "group",
    groupIds: user.groupIds || [],
  };
}

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
  } else {
    allowed = permissions.permissions[feature][action];
  }
  
  return {
    allowed,
    permissions,
    reason: allowed ? undefined : `No ${action} permission for ${feature}`
  };
}
