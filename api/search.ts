import type { VercelResponse } from "@vercel/node";
import { storage } from "../shared/storage.js";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "./_lib/apiHandler.js";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.json({ metadata: [], licenses: [], series: [] });
      }

      const results = await storage.globalSearch(q, req.userPermissions!);
      res.json(results);
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ message: "Search failed" });
    }
  })
);
