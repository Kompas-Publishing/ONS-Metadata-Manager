import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../../shared/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id, licenseId } = req.query;

      if (!id || typeof id !== "string" || !licenseId || typeof licenseId !== "string") {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      await storage.unlinkSeriesFromLicense(id, licenseId);
      res.json({ message: "License unlinked successfully" });
    } catch (error) {
      console.error("Error unlinking license from series:", error);
      res.status(500).json({ message: "Failed to unlink license" });
    }
  })
);
