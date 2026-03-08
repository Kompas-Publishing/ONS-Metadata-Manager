import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const nextId = await storage.peekNextId();
      res.json(nextId);
    } catch (error) {
      console.error("Error getting next ID:", error);
      res.status(500).json({ message: "Failed to get next ID" });
    }
  })
);
