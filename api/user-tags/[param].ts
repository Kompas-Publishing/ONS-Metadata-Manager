import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { param } = req.query;
    const userId = req.user!.id;

    if (!param || typeof param !== "string") {
      return res.status(400).json({ message: "Invalid parameter" });
    }

    // GET /api/user-tags/genre (or contentType or tags)
    if (req.method === "GET") {
      // Check if it's a tag type (genre, contentType, tags)
      if (param === "genre" || param === "contentType" || param === "tags") {
        try {
          const tags = await storage.getUserTags(userId, param);
          res.json(tags);
        } catch (error) {
          console.error("Error fetching user tags:", error);
          res.status(500).json({ message: "Failed to fetch user tags" });
        }
        return;
      }

      return res.status(400).json({
        message: "Invalid type. Must be 'genre', 'contentType', or 'tags'"
      });
    }

    // DELETE /api/user-tags/123 (numeric ID)
    if (req.method === "DELETE") {
      const tagId = parseInt(param);

      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      try {
        await storage.deleteUserTag(tagId, userId);
        res.json({ message: "Tag deleted successfully" });
      } catch (error) {
        console.error("Error deleting user tag:", error);
        res.status(500).json({ message: "Failed to delete user tag" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
