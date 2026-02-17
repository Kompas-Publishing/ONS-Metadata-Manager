import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertLicenseSchema } from "../_shared/schema.js";
import { z } from "zod";
import { getUserPermissions } from "../_server/permissions.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method === "GET") {
    try {
      const licenses = await storage.listLicenses();
      return res.json(licenses);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      return res.status(500).json({ message: "Failed to fetch licenses" });
    }
  }

  if (req.method === "POST") {
    try {
      const createLicenseWithMetadataSchema = insertLicenseSchema.extend({
        metadataIds: z.array(z.string()).optional(),
      });

      const validation = createLicenseWithMetadataSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { metadataIds, ...licenseData } = validation.data;
      const license = await storage.createLicense(licenseData);
      
      if (metadataIds && metadataIds.length > 0) {
        const userId = req.user?.id;
        if (userId) {
          const permissions = await getUserPermissions(userId);
          if (permissions) {
            await storage.bulkUpdateMetadata(
              metadataIds.map(id => ({ id, data: { licenseId: license.id } })),
              permissions
            );
          }
        }
      }

      return res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      return res.status(500).json({ message: "Failed to create license" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});
