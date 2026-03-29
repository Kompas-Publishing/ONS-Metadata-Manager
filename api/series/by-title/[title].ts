import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../shared/storage.js";
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
        // Auto-create series record if metadata files exist with this title
        const files = await storage.getMetadataBySeriesTitle(decodedTitle, req.userPermissions!);
        if (files.length === 0) {
          return res.status(404).json({ message: "Series not found" });
        }
        item = await storage.upsertSeries({ title: decodedTitle });
      }

      const [licenses, tasks] = await Promise.all([
        storage.getSeriesLicensesFromEpisodes(item.id),
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
