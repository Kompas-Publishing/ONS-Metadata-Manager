import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";
import { insertMetadataFileSchema } from "@shared/schema";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  // GET /api/metadata/:id - Get single metadata file
  if (req.method === "GET") {
    return requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const file = await storage.getMetadataFile(id, req.permissions!);
        if (!file) {
          return res.status(404).json({ message: "File not found" });
        }
        res.json(file);
      } catch (error) {
        console.error("Error fetching metadata file:", error);
        res.status(500).json({ message: "Failed to fetch metadata file" });
      }
    })(req, res);
  }

  // PATCH /api/metadata/:id - Update metadata file
  if (req.method === "PATCH") {
    return requirePermission("edit")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const permissions = req.permissions!;

        // Check if file exists and user can see it
        const existingFile = await storage.getMetadataFile(id, permissions);
        if (!existingFile) {
          return res.status(404).json({ message: "File not found" });
        }

        const parsed = insertMetadataFileSchema.partial().safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request data",
            errors: parsed.error.flatten(),
          });
        }

        const data = parsed.data;

        // Handle breakTime normalization if present
        if (data.breakTime !== undefined || data.breakTimes !== undefined) {
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
          data.breakTime = breakTimesArray[0] || null;
          data.breakTimes = breakTimesArray;
        }

        const updatedFile = await storage.updateMetadataFile(id, data, permissions!);
        res.json(updatedFile);
      } catch (error: any) {
        console.error("Error updating metadata file:", error);
        res.status(500).json({ message: "Failed to update metadata file" });
      }
    })(req, res);
  }

  // DELETE /api/metadata/:id - Delete metadata file
  if (req.method === "DELETE") {
    return requirePermission("edit")(async (req: AuthenticatedRequest, res: VercelResponse) => {
      try {
        const permissions = req.permissions!;

        // Check if file exists and user can see it
        const existingFile = await storage.getMetadataFile(id, permissions);
        if (!existingFile) {
          return res.status(404).json({ message: "File not found" });
        }

        await storage.deleteMetadataFile(id, permissions!);
        res.json({ message: "File deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting metadata file:", error);
        res.status(500).json({ message: "Failed to delete metadata file" });
      }
    })(req, res);
  }

  return res.status(405).json({ message: "Method not allowed" });
});
