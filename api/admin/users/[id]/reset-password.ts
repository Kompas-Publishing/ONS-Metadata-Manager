import type { VercelResponse } from "@vercel/node";
import { storage } from "../../../../_server/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../../../_lib/apiHandler.js";
import bcrypt from "bcryptjs";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Generate a random 12-character password
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let newPassword = "";
      for (let i = 0; i < 12; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      const updatedUser = await storage.updateUserPassword(id, hashedPassword);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        message: "Password reset successful", 
        newPassword 
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  })
);
