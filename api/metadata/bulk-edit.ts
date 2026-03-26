import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

const bulkEditSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  data: z.object({
    draft: z.number().min(0).max(1).optional(),
    subsStatus: z.string().optional(),
    metadataTimesStatus: z.string().optional(),
    licenseIds: z.array(z.string()).optional(),
  }),
});

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const validation = bulkEditSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { ids, data } = validation.data;
      const { licenseIds, ...metadataData } = data;

      // Update metadata fields
      if (Object.keys(metadataData).length > 0) {
        await storage.bulkUpdateMetadata(
          ids.map(id => ({ id, data: metadataData })),
          req.userPermissions!
        );
      }

      // Update license links if provided
      if (licenseIds !== undefined) {
        for (const id of ids) {
          await storage.updateMetadataFile(id, { licenseIds } as any, req.userPermissions!);
        }
      }

      res.json({ message: `Updated ${ids.length} files successfully` });
    } catch (error) {
      console.error("Error bulk editing metadata:", error);
      res.status(500).json({ message: "Failed to bulk edit metadata" });
    }
  })
);
