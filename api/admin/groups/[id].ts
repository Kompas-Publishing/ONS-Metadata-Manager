import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if any users are assigned to this group
      const users = await storage.getUsersByGroupId(id);
      if (users.length > 0) {
        return res
          .status(400)
          .json({
            message: "Cannot delete group with assigned users. Please reassign users first.",
            userCount: users.length,
          });
      }

      await storage.deleteGroup(id);
      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Failed to delete group" });
    }
  })
);
