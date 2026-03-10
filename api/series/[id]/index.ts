import type { VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const { productionYear, driveLinks, websiteLink, subsFromDistributor } = req.body;
      
      const updated = await storage.updateSeries(id, {
        productionYear,
        driveLinks,
        websiteLink,
        subsFromDistributor
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Series not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating series:", error);
      res.status(500).json({ message: "Failed to update series" });
    }
  })
);
