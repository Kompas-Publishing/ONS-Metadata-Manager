import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler";
import { storage } from "../_server/storage";
import bcrypt from "bcryptjs";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const user = req.user!;
        const { password: removedPassword, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
      return;
    }

    if (req.method === "PATCH") {
      try {
        const userId = req.user!.id;
        const { firstName, lastName, profileImageUrl, currentPassword, newPassword } = req.body;

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const updateData: any = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;

        if (newPassword) {
          if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required" });
          }

          const isMatch = await bcrypt.compare(currentPassword, user.password || "");
          if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password" });
          }

          updateData.password = await bcrypt.hash(newPassword, 12);
        }

        const updatedUser = await storage.updateUserProfile(userId, updateData);
        const { password: removedPassword, ...userWithoutPassword } = updatedUser as any;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Failed to update profile" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
