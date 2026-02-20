import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { licenseBatchGenerateSchema } from "../_shared/schema.js";
import { getUserPermissions } from "../_server/permissions.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const permissions = await getUserPermissions(userId);
  if (!permissions || !permissions.permissions.licenses.write) {
    return res.status(403).json({ message: "No write permission for licenses" });
  }

  try {
    const validation = licenseBatchGenerateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const files = await storage.generateLicenseDrafts(validation.data, userId);
    return res.json({ message: "Drafts generated successfully", count: files.length, files });
  } catch (error) {
    console.error("Error generating license drafts:", error);
    return res.status(500).json({ message: "Failed to generate drafts" });
  }
});
