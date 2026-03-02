import type { VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { title } = req.query;

  if (!title || typeof title !== "string") {
    return res.status(400).json({ message: "Invalid title" });
  }

  // DELETE /api/metadata/series/:title - Delete all files for a series
  if (req.method === "DELETE") {
    return requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const decodedTitle = decodeURIComponent(title);
        const count = await storage.deleteMetadataBySeries(
          decodedTitle,
          req.permissions!
        );
        res.json({ message: `Deleted ${count} files for series: ${decodedTitle}`, count });
      } catch (error) {
        console.error(`[DELETE metadata/series/${title}] Error:`, error);
        res.status(500).json({ message: "Failed to delete series metadata" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
