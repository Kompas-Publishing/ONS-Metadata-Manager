import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("edit")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { licenseId, metadataIds } = req.body;

      if (!licenseId || !metadataIds || !Array.isArray(metadataIds)) {
        return res.status(400).json({ message: "licenseId and metadataIds array are required" });
      }

      // Update all selected metadata files to point to this license
      await storage.bulkUpdateMetadata(
        metadataIds.map((id: string) => ({ id, data: { licenseId } })),
        req.permissions!
      );

      res.json({ message: "Metadata linked to license successfully" });
    } catch (error) {
      console.error("Error linking metadata to license:", error);
      res.status(500).json({ message: "Failed to link metadata" });
    }
  })
);
