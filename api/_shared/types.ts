import type { User } from "./schema.js";

export interface UserPermissions {
  user: User;
  isAdmin: boolean;
  isActive: boolean;
  permissions: {
    metadata: { read: boolean; write: boolean };
    licenses: { read: boolean; write: boolean };
    tasks: { read: boolean; write: boolean };
    ai: boolean;
  };
  fileVisibility: "own" | "all" | "group";
  groupIds: string[];
}

export type PermissionFeature = "metadata" | "licenses" | "tasks" | "ai";
export type PermissionAction = "read" | "write";

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
