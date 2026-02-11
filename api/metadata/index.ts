import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertMetadataFileSchema } from "../_shared/schema.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  // GET /api/metadata - Get all metadata files
  if (req.method === "GET") {
    return requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const { licenseId } = req.query;
        const files = await storage.getAllMetadataFiles(
          req.permissions!,
          typeof licenseId === "string" ? licenseId : undefined
        );
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
        const nextId = await storage.consumeNextId();

        const createdFile = await storage.createMetadataFile(
          {
            ...data,
            breakTime: breakTimesArray[0] || null,
            breakTimes: breakTimesArray,
          },
          nextId,
          permissions!
        );

        res.json(createdFile);
      } catch (error: any) {
        console.error("Error creating metadata file:", error);
        res.status(500).json({ message: "Failed to create metadata file" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
