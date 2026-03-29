import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";
import { z } from "zod";

export default apiHandler(
  requirePermission("contracts")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid contract ID" });
    }

    if (req.method === "POST") {
      try {
        const schema = z.object({
          licenseId: z.string().min(1),
          sortOrder: z.number().optional(),
          sourceTitle: z.string().optional(),
          sourceTitles: z.any().optional(),
          packageLabel: z.string().optional(),
          sourceReference: z.string().optional(),
          notes: z.string().optional(),
          sourceSnapshot: z.any().optional(),
          mappingStatus: z.string().optional(),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
        }
        const link = await storage.linkContractToLicense({ contractId: id, ...validation.data });
        return res.json(link || { message: "License linked" });
      } catch (error) {
        console.error("Error linking license:", error);
        return res.status(500).json({ message: "Failed to link license" });
      }
    }

    if (req.method === "DELETE") {
      try {
        const { licenseId } = req.body;
        if (!licenseId) return res.status(400).json({ message: "licenseId is required" });
        await storage.unlinkContractFromLicense(id, licenseId);
        return res.json({ message: "License unlinked" });
      } catch (error) {
        console.error("Error unlinking license:", error);
        return res.status(500).json({ message: "Failed to unlink license" });
      }
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
