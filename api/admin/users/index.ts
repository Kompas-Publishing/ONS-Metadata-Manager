import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../server/storage";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../_lib/apiHandler";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const users = await storage.listAllUsers();
        res.json({ users });
      } catch (error) {
        console.error("Error listing users:", error);
        res.status(500).json({ message: "Failed to list users" });
      }
      return;
    }

    if (req.method === "PATCH") {
      // Bulk update users
      try {
        const updates = req.body;

        if (!Array.isArray(updates)) {
          return res.status(400).json({ message: "Expected array of updates" });
        }

        for (const update of updates) {
          if (update.id && update.data) {
            await storage.updateUser(update.id, update.data);
          }
        }

        res.json({ message: "Users updated successfully" });
      } catch (error) {
        console.error("Error updating users:", error);
        res.status(500).json({ message: "Failed to update users" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
