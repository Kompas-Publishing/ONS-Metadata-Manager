import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { title } = req.query;
      if (!title || typeof title !== 'string') {
          return res.status(400).json({ message: "Title is required" });
      }
      
      const decodedTitle = decodeURIComponent(title);
      const files = await storage.getMetadataBySeriesTitle(decodedTitle, req.permissions!);
      res.json(files);
    } catch (error) {
      console.error("Error fetching series metadata:", error);
      res.status(500).json({ message: "Failed to fetch series metadata" });
    }
  })
);
