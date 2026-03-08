import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      // Basic validation for multi-batch
      if (!req.body.batches || !Array.isArray(req.body.batches)) {
        return res.status(400).json({ message: "Invalid request: batches array is required" });
      }

      const files = await storage.createMultiBatchMetadataFiles(
        {
          batches: req.body.batches,
          taskDescription: req.body.taskDescription
        },
        req.userPermissions!,
      );

      res.json({
        message: "Multi-batch created successfully",
        count: files.length,
        files,
      });
    } catch (error) {
      console.error("Error creating multi-batch:", error);
      res.status(500).json({ message: "Failed to create multi-batch" });
    }
  })
);
