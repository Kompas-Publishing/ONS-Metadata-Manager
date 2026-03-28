import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { z } from "zod";

export default apiHandler(
  requirePermission("contracts")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const contracts = await storage.listContracts();
        return res.json(contracts);
      } catch (error) {
        console.error("Error listing contracts:", error);
        return res.status(500).json({ message: "Failed to list contracts" });
      }
    }

    if (req.method === "POST") {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const schema = z.object({
          name: z.string().min(1),
          distributor: z.string().min(1),
          description: z.string().optional(),
          notes: z.string().optional(),
          fileUrl: z.string().optional(),
          fileName: z.string().optional(),
          sharedTerms: z.any().optional(),
          licenseIds: z.array(z.string()).optional(),
        });

        const validation = schema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
        }

        const { licenseIds, ...contractData } = validation.data;
        const contract = await storage.createContract({ ...contractData, createdBy: userId });

        // Link licenses if provided
        if (licenseIds && licenseIds.length > 0) {
          for (const licenseId of licenseIds) {
            await storage.linkContractToLicense(contract.id, licenseId);
          }
        }

        return res.json(contract);
      } catch (error) {
        console.error("Error creating contract:", error);
        return res.status(500).json({ message: "Failed to create contract" });
      }
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
