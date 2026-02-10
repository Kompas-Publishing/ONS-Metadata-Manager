import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertLicenseSchema } from "../_shared/schema.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method === "GET") {
    try {
      const licenses = await storage.listLicenses();
      return res.json(licenses);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      return res.status(500).json({ message: "Failed to fetch licenses" });
    }
  }

  if (req.method === "POST") {
    try {
      const validation = insertLicenseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const license = await storage.createLicense(validation.data);
      return res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      return res.status(500).json({ message: "Failed to create license" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});
