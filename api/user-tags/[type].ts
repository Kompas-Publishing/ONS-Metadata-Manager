import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { type } = req.query;
      const userId = req.user!.id;

      if (typeof type !== "string" || (type !== "genre" && type !== "contentType" && type !== "tags")) {
        return res
          .status(400)
          .json({ message: "Invalid type. Must be 'genre', 'contentType', or 'tags'" });
      }

      const tags = await storage.getUserTags(userId, type);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching user tags:", error);
      res.status(500).json({ message: "Failed to fetch user tags" });
    }
  })
);
