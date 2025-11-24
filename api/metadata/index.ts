import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";
import { insertMetadataFileSchema } from "@shared/schema";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  // GET /api/metadata - Get all metadata files
  if (req.method === "GET") {
    return requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const files = await storage.getAllMetadataFiles(req.permissions!);
        res.json(files);
      } catch (error) {
        console.error("Error fetching metadata files:", error);
        res.status(500).json({ message: "Failed to fetch metadata files" });
      }
    })(req, res);
  }

  // POST /api/metadata - Create new metadata file
  if (req.method === "POST") {
    return requirePermission("write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const userId = req.user!.id;
        const permissions = req.permissions!;

        const parsed = insertMetadataFileSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request data",
            errors: parsed.error.flatten(),
          });
        }

        const data = parsed.data;

        // Handle breakTime normalization
        let breakTimesArray: string[] = [];
        if (data.breakTime) {
          breakTimesArray = [data.breakTime.trim()];
        }
        if (data.breakTimes && data.breakTimes.length > 0) {
          const filtered = data.breakTimes
            .filter((t: string) => t && t.trim())
            .map((t: string) => t.trim());
          if (filtered.length > 0) {
            breakTimesArray = filtered;
          }
        }

        // Auto-generate ID
        const { id: nextId } = await storage.consumeNextId();

        const createdFile = await storage.createMetadataFile({
          ...data,
          id: nextId,
          breakTime: breakTimesArray[0] || null,
          breakTimes: breakTimesArray,
          createdBy: userId,
        });

        res.json(createdFile);
      } catch (error: any) {
        console.error("Error creating metadata file:", error);
        res.status(500).json({ message: "Failed to create metadata file" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
