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
      const { groupIds } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!Array.isArray(groupIds)) {
        return res.status(400).json({ message: "groupIds must be an array" });
      }

      await storage.updateUser(id, { groupIds });
      res.json({ message: "User groups updated successfully" });
    } catch (error) {
      console.error("Error updating user groups:", error);
      res.status(500).json({ message: "Failed to update user groups" });
    }
  })
);
