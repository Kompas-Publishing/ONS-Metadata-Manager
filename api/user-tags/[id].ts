import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const userId = req.user!.id;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      const tagId = parseInt(id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      await storage.deleteUserTag(tagId, userId);
      res.json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error("Error deleting user tag:", error);
      res.status(500).json({ message: "Failed to delete user tag" });
    }
  })
);
