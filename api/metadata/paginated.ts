import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      const channel = req.query.channel as string | undefined;
      const rating = req.query.rating as string | undefined;

      console.log(`[Paginated] Loading page ${page}, limit ${limit}, search=${search}, channel=${channel}, rating=${rating}`);

      const result = await storage.getPaginatedMetadataFiles(page, limit, search, channel, rating, req.permissions!);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching paginated files:", error);
      res.status(500).json({ message: "Failed to fetch paginated files", error: error.message });
    }
  })
);
