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
          fileUrl: z.string().min(1),
          fileName: z.string().min(1),
          fileRole: z.string().optional(),
          sortOrder: z.number().optional(),
          notes: z.string().optional(),
        });
        const validation = schema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
        }
        const file = await storage.addContractFile({ contractId: id, ...validation.data });
        return res.json(file);
      } catch (error) {
        console.error("Error adding contract file:", error);
        return res.status(500).json({ message: "Failed to add file" });
      }
    }

    if (req.method === "DELETE") {
      try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ message: "fileId required" });
        await storage.removeContractFile(fileId);
        return res.json({ message: "File removed" });
      } catch (error) {
        console.error("Error removing contract file:", error);
        return res.status(500).json({ message: "Failed to remove file" });
      }
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
