import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../server/storage";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const { fileVisibility } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!fileVisibility || !["own", "group", "all"].includes(fileVisibility)) {
        return res
          .status(400)
          .json({ message: "Invalid file visibility. Must be own, group, or all" });
      }

      await storage.updateUserVisibility(id, fileVisibility);
      res.json({ message: "User file visibility updated successfully" });
    } catch (error) {
      console.error("Error updating user file visibility:", error);
      res.status(500).json({ message: "Failed to update user file visibility" });
    }
  })
);
