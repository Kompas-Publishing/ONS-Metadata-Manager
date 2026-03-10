import type { VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { title } = req.query;
      
      if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Invalid title" });
      }

      const decodedTitle = title; // Vercel already decodes query params
      
      let item = await storage.getSeriesByTitle(decodedTitle);
      
      if (!item) {
        // Auto-create series if it doesn't exist yet (handles legacy data)
        item = await storage.upsertSeries({
          title: decodedTitle,
        });
      }

      const [licenses, tasks] = await Promise.all([
        storage.getSeriesLicenses(item.id),
        storage.getSeriesTasks(item.id, req.userPermissions!)
      ]);

      res.json({
        ...item,
        licenses,
        tasks
      });
    } catch (error) {
      console.error("Error fetching series by title:", error);
      res.status(500).json({ message: "Failed to fetch series" });
    }
  })
);
