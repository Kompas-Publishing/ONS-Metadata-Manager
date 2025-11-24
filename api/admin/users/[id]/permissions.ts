import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const { canRead, canWrite, canEdit } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const updates = {
        canRead: canRead !== undefined ? (canRead ? 1 : 0) : 0,
        canWrite: canWrite !== undefined ? (canWrite ? 1 : 0) : 0,
        canEdit: canEdit !== undefined ? (canEdit ? 1 : 0) : 0,
      };

      await storage.updateUserPermissions(id, updates);
      res.json({ message: "User permissions updated successfully" });
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  })
);
