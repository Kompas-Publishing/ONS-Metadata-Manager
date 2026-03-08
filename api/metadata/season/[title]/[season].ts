import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../_lib/apiHandler";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { title, season } = req.query;

  if (!title || typeof title !== "string") {
    return res.status(400).json({ message: "Invalid title" });
  }

  const seasonNum = parseInt(season as string);
  if (isNaN(seasonNum)) {
    return res.status(400).json({ message: "Invalid season number" });
  }

  // GET /api/metadata/season/:title/:season - Get metadata for a specific season
  if (req.method === "GET") {
    return requirePermission("metadata", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const decodedTitle = decodeURIComponent(title);
        const files = await storage.getMetadataBySeason(
          decodedTitle,
          seasonNum,
          req.permissions!
        );
        res.json(files);
      } catch (error) {
        console.error(`[GET metadata/season/${title}/${season}] Error:`, error);
        res.status(500).json({ message: "Failed to fetch season metadata" });
      }
    })(req, res);
  }

  // DELETE /api/metadata/season/:title/:season - Delete all files for a specific season
  if (req.method === "DELETE") {
    return requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const decodedTitle = decodeURIComponent(title);
        const count = await storage.deleteMetadataBySeason(
          decodedTitle,
          seasonNum,
          req.permissions!
        );
        res.json({ message: `Deleted ${count} files for series: ${decodedTitle} season ${seasonNum}`, count });
      } catch (error) {
        console.error(`[DELETE metadata/season/${title}/${season}] Error:`, error);
        res.status(500).json({ message: "Failed to delete season metadata" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
