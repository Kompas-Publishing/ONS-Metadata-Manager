import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const users = await storage.listAllUsers();
        res.json({ users });
      } catch (error) {
        console.error("Error listing users:", error);
        res.status(500).json({ message: "Failed to list users" });
      }
      return;
    }

    if (req.method === "PATCH") {
      // Bulk update users
      try {
        const updates = req.body;

        if (!Array.isArray(updates)) {
          return res.status(400).json({ message: "Expected array of updates" });
        }

        for (const update of updates) {
          if (!update.id || !update.data) continue;

          const { id } = update;
          const data = update.data;

          // Apply updates using specific storage methods
          if (data.status !== undefined) {
            await storage.updateUserStatus(id, data.status);
          }
          if (data.isAdmin !== undefined) {
            await storage.updateUserAdminStatus(id, !!data.isAdmin);
          }
          if (data.canRead !== undefined || data.canWrite !== undefined || data.canEdit !== undefined) {
            const permissions = {
              canRead: data.canRead !== undefined ? (data.canRead ? 1 : 0) : 0,
              canWrite: data.canWrite !== undefined ? (data.canWrite ? 1 : 0) : 0,
              canEdit: data.canEdit !== undefined ? (data.canEdit ? 1 : 0) : 0,
            };
            await storage.updateUserPermissions(id, permissions);
          }
          if (data.fileVisibility !== undefined) {
            await storage.updateUserVisibility(id, data.fileVisibility);
          }
          if (data.groupIds !== undefined) {
            await storage.updateUserGroups(id, data.groupIds);
          }
        }

        res.json({ message: "Users updated successfully" });
      } catch (error) {
        console.error("Error updating users:", error);
        res.status(500).json({ message: "Failed to update users" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
