import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  // PATCH /api/series/:id - Update series details
  if (req.method === "PATCH") {
    return requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
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
    })(req, res);
  }

  // POST /api/series/:id/licenses - Link license to series
  if (req.method === "POST") {
    return requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const { licenseId, seasonRange } = req.body;
        await storage.linkSeriesToLicense(id, licenseId, seasonRange);
        res.json({ message: "License linked successfully" });
      } catch (error) {
        console.error("Error linking license to series:", error);
        res.status(500).json({ message: "Failed to link license" });
      }
    })(req, res);
  }

  // Handle DELETE (for unlinking license)
  // This is tricky as Vercel routes /api/series/[id]/licenses/[licenseId]
  // But let's check if the URL contains "licenses"
  
  return res.status(405).json({ message: "Method not allowed" });
});
