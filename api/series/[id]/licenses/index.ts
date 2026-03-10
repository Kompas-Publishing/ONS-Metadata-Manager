import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const { licenseId, seasonRange } = req.body;
      if (!licenseId) {
        return res.status(400).json({ message: "License ID required" });
      }

      await storage.linkSeriesToLicense(id, licenseId, seasonRange);
      res.json({ message: "License linked successfully" });
    } catch (error) {
      console.error("Error linking license to series:", error);
      res.status(500).json({ message: "Failed to link license" });
    }
  })
);
