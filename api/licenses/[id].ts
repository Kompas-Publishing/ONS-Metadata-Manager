import type { VercelResponse } from "@vercel/node";
import { storage } from "../../shared/storage.js";
import { apiHandler, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertLicenseSchema } from "../../shared/schema.js";
import { getUserPermissions } from "../../shared/permissions.js";
import { authenticate } from "../_lib/apiHandler.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { id } = req.query;
  const licenseId = Array.isArray(id) ? id[0] : id;

  if (!licenseId) {
    return res.status(400).json({ message: "License ID is required" });
  }

  await authenticate(req);
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const permissions = await getUserPermissions(userId);
  if (!permissions) return res.status(403).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    if (!permissions.features.licenses.read) {
      return res.status(403).json({ message: "No read permission for licenses" });
    }
    try {
      const license = await storage.getLicense(licenseId);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }
      return res.json(license);
    } catch (error) {
      console.error("Error fetching license:", error);
      return res.status(500).json({ message: "Failed to fetch license" });
    }
  }

  if (req.method === "PATCH") {
    if (!permissions.features.licenses.write) {
      return res.status(403).json({ message: "No write permission for licenses" });
    }
    try {
      const validation = insertLicenseSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const updated = await storage.updateLicense(licenseId, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "License not found" });
      }
      return res.json(updated);
    } catch (error) {
      console.error("Error updating license:", error);
      return res.status(500).json({ message: "Failed to update license" });
    }
  }

  if (req.method === "DELETE") {
    if (!permissions.features.licenses.write) {
      return res.status(403).json({ message: "No write permission for licenses" });
    }
    try {
      const success = await storage.deleteLicense(licenseId);
      if (!success) {
        return res.status(404).json({ message: "License not found" });
      }
      return res.json({ message: "License deleted successfully" });
    } catch (error) {
      console.error("Error deleting license:", error);
      return res.status(500).json({ message: "Failed to delete license" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
});
