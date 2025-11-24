import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "DELETE") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;
      const currentUserId = req.user!.id;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (id === currentUserId) {
        return res.status(400).json({ message: "You cannot delete yourself" });
      }

      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  })
);
