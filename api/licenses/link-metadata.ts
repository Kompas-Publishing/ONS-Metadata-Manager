import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { licenseId, metadataIds } = req.body;

      if (!metadataIds || !Array.isArray(metadataIds) || metadataIds.length === 0) {
        return res.status(400).json({ message: "metadataIds array is required" });
      }

      if (licenseId) {
        // Link: insert into metadataToLicenses join table
        const count = await storage.linkMetadataToLicense(licenseId, metadataIds);
        res.json({ message: "Metadata linked to license successfully", count });
      } else {
        // Unlink requires knowing which license to remove — use licenseIdToRemove
        const { licenseIdToRemove } = req.body;
        if (!licenseIdToRemove) {
          return res.status(400).json({ message: "licenseIdToRemove is required when unlinking" });
        }
        const count = await storage.unlinkMetadataFromLicense(licenseIdToRemove, metadataIds);
        res.json({ message: "Metadata unlinked from license successfully", count });
      }
    } catch (error) {
      console.error("Error linking metadata to license:", error);
      res.status(500).json({ message: "Failed to link metadata" });
    }
  })
);
