import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, type AuthenticatedRequest, authenticate } from "../_lib/apiHandler.js";
import { insertLicenseSchema } from "../_shared/schema.js";
import { z } from "zod";
import { getUserPermissions } from "../_server/permissions.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await authenticate(req);
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const permissions = await getUserPermissions(userId);
  if (!permissions) return res.status(403).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    if (!permissions.permissions.licenses.read) {
      return res.status(403).json({ message: "No read permission for licenses" });
    }
    try {
      const licenses = await storage.listLicenses();
      return res.json(licenses);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      return res.status(500).json({ message: "Failed to fetch licenses" });
    }
  }

  if (req.method === "POST") {
    if (!permissions.permissions.licenses.write) {
      return res.status(403).json({ message: "No write permission for licenses" });
    }
    try {
      const createLicenseWithMetadataSchema = insertLicenseSchema.extend({
        metadataIds: z.array(z.string()).optional(),
        newBatches: z.array(z.any()).optional(),
      });

      const validation = createLicenseWithMetadataSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { metadataIds, newBatches, ...licenseData } = validation.data;
      const license = await storage.createLicense(licenseData);
      
      // Link existing metadata
      if (metadataIds && metadataIds.length > 0) {
        await storage.bulkUpdateMetadata(
          metadataIds.map(id => ({ id, data: { licenseId: license.id } })),
          permissions
        );
      }

      // Create new batches
      if (newBatches && newBatches.length > 0) {
        await storage.createMultiBatchMetadataFiles(
          {
            batches: newBatches.map(batch => ({
              ...batch,
              licenseId: license.id
            }))
          },
          permissions
        );
      }

      return res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      return res.status(500).json({ message: "Failed to create license" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});
