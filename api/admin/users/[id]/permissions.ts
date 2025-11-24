import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../server/storage";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler";

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

      const updates: any = {};
      if (canRead !== undefined) updates.canRead = canRead ? 1 : 0;
      if (canWrite !== undefined) updates.canWrite = canWrite ? 1 : 0;
      if (canEdit !== undefined) updates.canEdit = canEdit ? 1 : 0;

      await storage.updateUser(id, updates);
      res.json({ message: "User permissions updated successfully" });
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  })
);
