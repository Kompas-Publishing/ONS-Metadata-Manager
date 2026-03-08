import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

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
          if (
            data.canReadMetadata !== undefined || 
            data.canWriteMetadata !== undefined || 
            data.canReadLicenses !== undefined || 
            data.canWriteLicenses !== undefined || 
            data.canReadTasks !== undefined || 
            data.canWriteTasks !== undefined || 
            data.canUseAI !== undefined ||
            data.canUseAIChat !== undefined
          ) {
            const permissions = {
              canReadMetadata: data.canReadMetadata !== undefined ? (data.canReadMetadata ? 1 : 0) : 0,
              canWriteMetadata: data.canWriteMetadata !== undefined ? (data.canWriteMetadata ? 1 : 0) : 0,
              canReadLicenses: data.canReadLicenses !== undefined ? (data.canReadLicenses ? 1 : 0) : 0,
              canWriteLicenses: data.canWriteLicenses !== undefined ? (data.canWriteLicenses ? 1 : 0) : 0,
              canReadTasks: data.canReadTasks !== undefined ? (data.canReadTasks ? 1 : 0) : 0,
              canWriteTasks: data.canWriteTasks !== undefined ? (data.canWriteTasks ? 1 : 0) : 0,
              canUseAI: data.canUseAI !== undefined ? (data.canUseAI ? 1 : 0) : 0,
              canUseAIChat: data.canUseAIChat !== undefined ? (data.canUseAIChat ? 1 : 0) : 0,
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
