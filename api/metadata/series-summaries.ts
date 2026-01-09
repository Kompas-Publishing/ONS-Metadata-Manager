import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const summaries = await storage.getSeriesSummaries(req.permissions!);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching series summaries:", error);
      res.status(500).json({ message: "Failed to fetch series summaries" });
    }
  })
);
