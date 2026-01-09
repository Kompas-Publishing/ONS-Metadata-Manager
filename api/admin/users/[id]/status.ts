import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../server/storage";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "PATCH") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const { status } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!status || !["active", "pending", "archived"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status. Must be active, pending, or archived" });
      }

      await storage.updateUserStatus(id, status);
      res.json({ message: "User status updated successfully" });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  })
);
