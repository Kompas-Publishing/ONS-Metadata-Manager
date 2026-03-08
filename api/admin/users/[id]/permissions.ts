import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const { 
        canReadMetadata, 
        canWriteMetadata, 
        canReadLicenses, 
        canWriteLicenses, 
        canReadTasks, 
        canWriteTasks, 
        canUseAI,
        canUseAIChat
      } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const updates = {
        canReadMetadata: canReadMetadata !== undefined ? (canReadMetadata ? 1 : 0) : 0,
        canWriteMetadata: canWriteMetadata !== undefined ? (canWriteMetadata ? 1 : 0) : 0,
        canReadLicenses: canReadLicenses !== undefined ? (canReadLicenses ? 1 : 0) : 0,
        canWriteLicenses: canWriteLicenses !== undefined ? (canWriteLicenses ? 1 : 0) : 0,
        canReadTasks: canReadTasks !== undefined ? (canReadTasks ? 1 : 0) : 0,
        canWriteTasks: canWriteTasks !== undefined ? (canWriteTasks ? 1 : 0) : 0,
        canUseAI: canUseAI !== undefined ? (canUseAI ? 1 : 0) : 0,
        canUseAIChat: canUseAIChat !== undefined ? (canUseAIChat ? 1 : 0) : 0,
      };

      await storage.updateUserPermissions(id, updates);
      res.json({ message: "User permissions updated successfully" });
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  })
);
