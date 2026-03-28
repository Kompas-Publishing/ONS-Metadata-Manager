import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

export default apiHandler(
  requirePermission("contracts")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid contract ID" });
    }

    if (req.method === "GET") {
      try {
        const contract = await storage.getContract(id);
        if (!contract) return res.status(404).json({ message: "Contract not found" });
        return res.json(contract);
      } catch (error) {
        console.error("Error fetching contract:", error);
        return res.status(500).json({ message: "Failed to fetch contract" });
      }
    }

    if (req.method === "PATCH") {
      try {
        const schema = z.object({
          name: z.string().optional(),
          distributor: z.string().optional(),
          description: z.string().optional().nullable(),
          contractMode: z.string().optional().nullable(),
          status: z.string().optional(),
          notes: z.string().optional().nullable(),
          totalFeeAmount: z.string().optional().nullable(),
          totalFeeCurrency: z.string().optional(),
          sharedTerms: z.any().optional(),
        });

        const validation = schema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
        }

        const updated = await storage.updateContract(id, validation.data);
        if (!updated) return res.status(404).json({ message: "Contract not found" });
        return res.json(updated);
      } catch (error) {
        console.error("Error updating contract:", error);
        return res.status(500).json({ message: "Failed to update contract" });
      }
    }

    if (req.method === "DELETE") {
      try {
        const success = await storage.deleteContract(id);
        if (!success) return res.status(404).json({ message: "Contract not found" });
        return res.json({ message: "Contract deleted" });
      } catch (error) {
        console.error("Error deleting contract:", error);
        return res.status(500).json({ message: "Failed to delete contract" });
      }
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
