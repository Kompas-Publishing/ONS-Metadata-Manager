import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";
import { batchCreateSchema } from "@shared/schema";

export default apiHandler(
  requirePermission("write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const validation = batchCreateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const files = await storage.createBatchMetadataFiles(
        validation.data,
        req.permissions!,
      );

      res.json({
        message: "Batch created successfully",
        count: files.length,
        files,
      });
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: "Failed to create batch" });
    }
  })
);
