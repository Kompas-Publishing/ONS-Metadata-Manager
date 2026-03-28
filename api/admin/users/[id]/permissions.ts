import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../shared/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const data = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Fetch current user so unspecified permissions keep their current value
      const currentUser = await storage.getUserById(id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updates = {
        canReadMetadata: data.canReadMetadata !== undefined ? (data.canReadMetadata ? 1 : 0) : currentUser.canReadMetadata,
        canWriteMetadata: data.canWriteMetadata !== undefined ? (data.canWriteMetadata ? 1 : 0) : currentUser.canWriteMetadata,
        canReadLicenses: data.canReadLicenses !== undefined ? (data.canReadLicenses ? 1 : 0) : currentUser.canReadLicenses,
        canWriteLicenses: data.canWriteLicenses !== undefined ? (data.canWriteLicenses ? 1 : 0) : currentUser.canWriteLicenses,
        canReadTasks: data.canReadTasks !== undefined ? (data.canReadTasks ? 1 : 0) : currentUser.canReadTasks,
        canWriteTasks: data.canWriteTasks !== undefined ? (data.canWriteTasks ? 1 : 0) : currentUser.canWriteTasks,
        canUseAI: data.canUseAI !== undefined ? (data.canUseAI ? 1 : 0) : currentUser.canUseAI,
        canUseAIChat: data.canUseAIChat !== undefined ? (data.canUseAIChat ? 1 : 0) : currentUser.canUseAIChat,
        canAccessContracts: data.canAccessContracts !== undefined ? (data.canAccessContracts ? 1 : 0) : (currentUser as any).canAccessContracts || 0,
      };

      await storage.updateUserPermissions(id, updates);
      res.json({ message: "User permissions updated successfully" });
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  })
);
