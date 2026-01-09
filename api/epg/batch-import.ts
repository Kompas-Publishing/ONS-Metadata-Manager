import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";
import { z } from "zod";
import { insertMetadataFileSchema } from "../../shared/schema";

// Schema for the incoming batch items - slightly looser than the insert schema to allow partial updates?
// Actually, we want to receive fully formed objects from the client logic
const epgBatchSchema = z.object({
  items: z.array(insertMetadataFileSchema.extend({
    // Optional ID to force update specific records, though we mostly match by logical key
    id: z.string().optional(),
  }))
});

export default apiHandler(
  requirePermission("write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const validation = epgBatchSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validation.error.errors 
        });
      }

      const { items } = validation.data;
      const stats = {
        total: items.length,
        created: 0,
        updated: 0,
        errors: 0
      };

      // We process sequentially or in parallel?
      // Since `consumeNextId` locks/updates a row, sequential might be safer or we need a batch ID reservation.
      // But `storage.createMetadataFile` calls `consumeNextId` inside? No, the route usually does.
      // Wait, `createMetadataFile` takes `id` as param.
      
      // Let's implement a smart upsert function in storage? 
      // Or handle logic here.
      // Matching logic:
      // 1. Title + Season + Episode (for Series)
      // 2. Title (for Movies/Others if no season/episode)
      
      // Fetching ALL metadata to check existence is too heavy.
      // We should check one by one or batch check.
      // Given Vercel timeout (30s), we should rely on the client sending small batches (e.g. 50 items).
      
      for (const item of items) {
        try {
          // Try to find existing file
          let existingFiles: any[] = [];
          
          if (item.season && item.episode) {
             existingFiles = await storage.getMetadataBySeason(item.title, item.season, req.permissions!);
             existingFiles = existingFiles.filter(f => f.episode === item.episode);
          } else {
             // For movies/others, checking by title might match multiple (duplicates).
             // Let's assume title must be unique for non-series? Or just match first.
             existingFiles = await storage.getMetadataBySeriesTitle(item.title, req.permissions!);
          }

          if (existingFiles.length > 0) {
            // Update existing
            const fileToUpdate = existingFiles[0];
            await storage.updateMetadataFile(fileToUpdate.id, {
              ...item,
              // Keep existing creation date/user
              draft: fileToUpdate.draft, // Don't unpublish if already published? Or should EPG publish it?
              // Let's assume EPG import shouldn't revert 'Published' to 'Draft' unless specified.
              // But here we are just updating metadata.
              isEpgGenerated: 1, // Mark as EPG generated
              lastAired: item.lastAired || new Date(),
            }, req.permissions!);
            stats.updated++;
          } else {
            // Create new
            const nextId = await storage.consumeNextId();
            await storage.createMetadataFile({
              ...item,
              isEpgGenerated: 1,
              lastAired: item.lastAired || new Date(),
              draft: 0, // EPG items usually considered 'live' or draft? Let's say published (0) or draft (1)? 
                        // Prompt said "Blue border for EPG-generated files (vs orange for drafts)".
                        // This implies EPG files are NOT drafts by default? Or they are drafts but blue?
                        // Let's default to Draft (1) to be safe, user can publish.
                        // Actually, prompts says: "Blue border for EPG-generated files (vs orange for drafts)"
                        // This implies distinction. 
                        // Let's set draft = 0 (Published) but rely on isEpgGenerated flag?
                        // Or set draft = 1?
                        // Let's set draft = 1 (Draft) for safety.
                        draft: 1,
            }, nextId, req.permissions!);
            stats.created++;
          }
        } catch (err) {
          console.error("Error processing item:", item.title, err);
          stats.errors++;
        }
      }

      res.json(stats);
    } catch (error) {
      console.error("Batch import error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  })
);
