import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "./_lib/apiHandler";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const stats = await storage.getStats(req.permissions!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  })
);
