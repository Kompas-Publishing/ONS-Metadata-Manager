import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const category = req.query.category as string | undefined;
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '24');
      const search = req.query.search as string | undefined;

      const result = await storage.getSeriesSummaries(category, req.permissions!, page, limit, search);
      res.json(result);
    } catch (error) {
      console.error("Error fetching series summaries:", error);
      res.status(500).json({ message: "Failed to fetch series summaries" });
    }
  })
);
