import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { id } = req.query;
    const currentUserId = req.user!.id;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // PATCH /api/admin/users/:id - Update user isAdmin status
    if (req.method === "PATCH") {
      try {
        const { isAdmin } = req.body;

        if (typeof isAdmin !== "boolean") {
          return res.status(400).json({ message: "isAdmin must be a boolean" });
        }

        if (id === currentUserId && !isAdmin) {
          return res.status(400).json({
            message: "You cannot remove your own admin status"
          });
        }

        const updatedUser = await storage.updateUserAdminStatus(id, isAdmin);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user admin status:", error);
        res.status(500).json({ message: "Failed to update user admin status" });
      }
      return;
    }

    // DELETE /api/admin/users/:id - Delete user
    if (req.method === "DELETE") {
      try {
        if (id === currentUserId) {
          return res.status(400).json({ message: "You cannot delete yourself" });
        }

        await storage.deleteUser(id);
        res.json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
